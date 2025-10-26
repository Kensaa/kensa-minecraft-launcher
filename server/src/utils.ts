import { and, eq, inArray } from 'drizzle-orm'
import { filesTable, gameDirectoriesTable, profilesTable } from './db/schema'
import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { hashFile } from 'utils'

export type Database = BetterSQLite3Database<Record<string, never>>
type DatabaseFile = typeof filesTable.$inferSelect
type DatabaseProfile = typeof profilesTable.$inferSelect
type DatabaseGameDirectory = typeof gameDirectoriesTable.$inferSelect

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

export interface Tree<D> {
    [key: string]: Tree<D> | D
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
        curr[filename] = selectFn(file)
        // curr[filename] = file.hash
    }
    return tree
}

export function hashPassword(password: Buffer, salt: Buffer): Buffer {
    return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha256')
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
        .map(seg => seg.replace(/[^a-zA-Z0-9._-]/g, '_'))
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
            if (stat.isFile()) {
                let i = currentFiles.findIndex(f => f.filepath === filepath)
                if (i === -1) {
                    // file does not exist in the db
                    await database.insert(filesTable).values({
                        filepath,
                        game_directory: gameDirectory.name,
                        last_modified: stat.mtime,
                        hash: await hashFile(absFilepath)
                    })
                } else {
                    // file exists, check last modified to see if a rehash is useful
                    const currentFile = currentFiles[i]
                    seenFiles[i] = true
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
}
