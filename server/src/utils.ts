import { and, eq, inArray } from 'drizzle-orm'
import { filesTable, gameDirectoriesTable, profilesTable } from './db/schema'
import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { hashFile } from 'utils'
import type { Tree } from 'utils'
import archiver from 'archiver'
import { Response } from 'express-api-router'

export interface APIInstances {
    database: Database
    staticDirectory: string
    authSecret: string
}

export type Database = BetterSQLite3Database<Record<string, never>>
type DatabaseFile = typeof filesTable.$inferSelect
type DatabaseProfile = typeof profilesTable.$inferSelect
export type DatabaseGameDirectory = typeof gameDirectoriesTable.$inferSelect

export async function getProfile(
    db: Database,
    profile_id: DatabaseProfile['id']
): Promise<typeof profilesTable.$inferSelect | undefined> {
    const profiles = await db
        .select()
        .from(profilesTable)
        .where(eq(profilesTable.id, profile_id))
    if (profiles.length == 0) return undefined
    return profiles[0]
}

export async function getGameDirectory(
    db: Database,
    name: DatabaseGameDirectory['name']
) {
    const gameDirectories = await db
        .select()
        .from(gameDirectoriesTable)
        .where(eq(gameDirectoriesTable.name, name))
    if (gameDirectories.length == 0) return undefined
    return gameDirectories[0]
}

/**
 * Creates a recursive object representing the gameDirectory of a profile as a tree
 * @param files the files of the profile (from the database)
 * @param selectfn the function selecting data from a file to put in the tree
 * @returns the profile's file tree
 */
export function buildFileTree<D>(
    files: DatabaseFile[],
    selectFn: (file: DatabaseFile) => D
): Tree<D> {
    const tree: Tree<D> = {}

    for (const file of files) {
        const parts = file.filepath.split('/')
        let curr = tree
        const filename = parts.pop()!
        for (const part of parts) {
            if (curr[part] === undefined) curr[part] = {}
            curr = curr[part] as Tree<D>
        }
        curr[filename] = file.is_directory ? {} : selectFn(file)
    }
    return tree
}

export function hashPassword(password: Buffer, salt: Buffer): Buffer {
    return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha256')
}

const validFileRegex = /[^a-zA-Z0-9 ()._-]/g
export function sanitizeFileName(filename: string): string {
    return filename.replace(validFileRegex, '_')
}
export function sanitizeFilePath(inputPath: string, baseDir: string): string {
    const cleanInput = inputPath.replace(/\0/g, '').trim()
    const normalized = path.normalize(cleanInput)

    if (path.isAbsolute(normalized))
        throw new Error('Absolute paths are not allowed')
    if (normalized.startsWith('..'))
        throw new Error('Path traversal attempt detected')

    const safeSegments = normalized
        .split(path.sep)
        .map(seg => seg.replace(validFileRegex, '_'))
        .filter(Boolean)

    const safeRelative = safeSegments.join(path.sep)

    const resolvedBase = path.resolve(baseDir)
    const safeFullPath = path.resolve(resolvedBase, safeRelative)

    if (!safeFullPath.startsWith(resolvedBase + path.sep))
        throw new Error('Path escapes base directory')

    return safeFullPath
}

export function getGameDirectoryPath(
    staticDirectory: string,
    gameDirectory: DatabaseGameDirectory
) {
    const gameDirectoryPath = path.join(
        staticDirectory,
        'gameDirectories',
        gameDirectory.name
    )
    return gameDirectoryPath
}

export async function refreshGameDirectory(
    staticDirectory: string,
    database: Database,
    gameDirectory: DatabaseGameDirectory
) {
    const gameDirectoryPath = getGameDirectoryPath(
        staticDirectory,
        gameDirectory
    )
    if (!fs.existsSync(gameDirectoryPath)) fs.mkdirSync(gameDirectoryPath)

    const currentFiles = await database
        .select()
        .from(filesTable)
        .where(eq(filesTable.game_directory, gameDirectory.name))

    const seenFiles = new Array(currentFiles.length).fill(false) // array containing bools indicating if the curresponding file in the currentFiles array has been seen

    async function exploreDir(current: string) {
        const absPath = path.join(gameDirectoryPath, current)
        for (const file of fs.readdirSync(absPath)) {
            // path of the file relative to the gameDirectory
            const filepath = path.join(current, file)
            // path of the file relative to the static directory
            const absFilepath = path.join(gameDirectoryPath, filepath)
            const stat = fs.statSync(absFilepath)
            const isFile = stat.isFile()

            const arrayIndex = currentFiles.findIndex(
                f => f.filepath === filepath
            )
            const existsInDB = arrayIndex !== -1

            if (existsInDB) {
                const currentFile = currentFiles[arrayIndex]
                seenFiles[arrayIndex] = true
                if (isFile) {
                    // file exists, check last modified to see if a rehash is useful
                    if (
                        stat.mtime.getTime() !==
                        currentFile.last_modified.getTime()
                    ) {
                        await database
                            .update(filesTable)
                            .set({
                                hash: await hashFile(absFilepath),
                                last_modified: stat.mtime
                            })
                            .where(
                                and(
                                    eq(
                                        filesTable.game_directory,
                                        gameDirectory.name
                                    ),
                                    eq(filesTable.filepath, filepath)
                                )
                            )
                    }
                }
            } else {
                // file does not exist in the db
                await database.insert(filesTable).values({
                    filepath,
                    game_directory: gameDirectory.name,
                    last_modified: stat.mtime,
                    hash: isFile ? await hashFile(absFilepath) : '',
                    is_directory: !isFile
                })
            }

            if (!isFile) {
                // is directory, recusively call
                await exploreDir(filepath)
            }
        }
    }

    await exploreDir('')

    // if some files that were is the database have not been seen, delete them from the database
    const toDelete = currentFiles
        .filter((_, i) => !seenFiles[i])
        .map(f => f.filepath)

    await database
        .delete(filesTable)
        .where(
            and(
                eq(filesTable.game_directory, gameDirectory.name),
                inArray(filesTable.filepath, toDelete)
            )
        )

    await database
        .update(gameDirectoriesTable)
        .set({
            last_modified: new Date()
        })
        .where(eq(gameDirectoriesTable.name, gameDirectory.name))
}

/**
 * Creates an archive from a directory
 * @param format zip or tar
 * @param directoryPath the path of the dir to add to the archive
 * @param outputFile the path to the archive
 * @param strip whether of not to strip the top layer of the input directory
 * @returns a promise that resolves when the archive is created
 */
export async function createArchive(
    format: 'zip' | 'tar',
    directoryPath: string,
    outputFile: string,
    strip: boolean
): Promise<void> {
    // return new Promise((res, rej) => {
    const writeStream = fs.createWriteStream(outputFile, { flags: 'w' })
    const archive = archiver(format, {
        zlib: {
            level: 9
        },
        gzip: true,
        gzipOptions: {
            level: 9
        }
    })
    archive.pipe(writeStream)

    archive.directory(
        directoryPath,
        strip ? false : path.basename(directoryPath)
    )
    await archive.finalize()
}

/**
 * Sends a file as a response to a request
 * @param res the response object
 * @param filepath the file to send
 * @returns a promise that resolve when the file is sent
 */
export async function sendFile(res: Response, filepath: string) {
    return new Promise<void>((resolve, reject) => {
        res.status(200).sendFile(filepath, err => {
            if (err) {
                reject(err)
            } else {
                resolve()
            }
        })
    })
}
