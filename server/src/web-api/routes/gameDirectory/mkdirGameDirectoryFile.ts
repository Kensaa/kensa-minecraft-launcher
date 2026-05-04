import { z } from 'zod'
import { APIRouter } from '../../web-api'
import { filesTable, gameDirectoriesTable } from '../../../db/schema'
import { and, count, eq } from 'drizzle-orm'
import { HTTPError } from 'express-api-router'
import fs from 'fs'
import path from 'path'
import {
    getGameDirectory,
    getGameDirectoryPath,
    localizePath,
    normalizePath,
    sanitizeFilePath
} from '../../../utils'

export function mkdirGameDirectoryFileHandler(router: APIRouter) {
    return router.createRouteHandler({
        authed: true,
        bodySchema: z.object({
            dirpath: z.string()
        }),
        paramsSchema: z.object({
            game_directory: z.string()
        }),
        querySchema: z.object(),
        responseSchema: z.object({
            filepath: z.string()
        }),
        async handler(req, res, instances, userTokenData) {
            const gameDirectory = await getGameDirectory(
                instances.database,
                req.params.game_directory
            )
            if (!gameDirectory)
                throw new HTTPError(404, 'game directory not found')

            const gameDirectoryPath = getGameDirectoryPath(
                instances.staticDirectory,
                gameDirectory
            )

            const dirpath = localizePath(req.body.dirpath)
            const diskFilepath = sanitizeFilePath(dirpath, gameDirectoryPath)

            const existingDir = await instances.database
                .select({
                    count: count()
                })
                .from(filesTable)
                .where(
                    and(
                        eq(filesTable.game_directory, gameDirectory.name),
                        eq(filesTable.is_directory, true),
                        eq(filesTable.filepath, dirpath)
                    )
                )
            if (existingDir[0].count > 0)
                throw new HTTPError(409, 'directory already exists')

            fs.mkdirSync(diskFilepath, { recursive: true })
            const stat = fs.statSync(diskFilepath)

            const insertedDir = await instances.database
                .insert(filesTable)
                .values({
                    filepath: dirpath,
                    game_directory: gameDirectory.name,
                    hash: '',
                    is_directory: true,
                    last_modified: stat.mtime
                })
                .returning({ filepath: filesTable.filepath })

            if (insertedDir.length === 0)
                throw new HTTPError(
                    500,
                    'an error occured while inserting directory into the database'
                )

            await instances.database
                .update(gameDirectoriesTable)
                .set({
                    last_modified: new Date()
                })
                .where(eq(gameDirectoriesTable.name, req.params.game_directory))

            return { filepath: normalizePath(insertedDir[0].filepath) }
        }
    })
}
