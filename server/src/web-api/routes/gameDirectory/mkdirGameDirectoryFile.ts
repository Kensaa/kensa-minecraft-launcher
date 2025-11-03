import { z } from 'zod'
import { APIRouter } from '../../web-api'
import { filesTable } from '../../../db/schema'
import { and, count, eq } from 'drizzle-orm'
import { HTTPError } from 'express-api-router'
import fs from 'fs'
import {
    getGameDirectory,
    getGameDirectoryPath,
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
        responseSchema: z.void(),
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

            const diskFilepath = sanitizeFilePath(
                req.body.dirpath,
                gameDirectoryPath
            )

            const existingDir = await instances.database
                .select({
                    count: count()
                })
                .from(filesTable)
                .where(
                    and(
                        eq(filesTable.game_directory, gameDirectory.name),
                        eq(filesTable.is_directory, true),
                        eq(filesTable.filepath, req.body.dirpath)
                    )
                )
            if (existingDir[0].count > 0)
                throw new HTTPError(409, 'directory already exists')

            fs.mkdirSync(diskFilepath, { recursive: true })
            const stat = fs.statSync(diskFilepath)
            await instances.database.insert(filesTable).values({
                filepath: req.body.dirpath,
                game_directory: gameDirectory.name,
                hash: '',
                is_directory: true,
                last_modified: stat.mtime
            })
        }
    })
}
