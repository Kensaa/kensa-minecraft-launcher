import { z } from 'zod'
import { APIRouter } from '../../web-api'
import { filesTable } from '../../../db/schema'
import { and, eq } from 'drizzle-orm'
import { HTTPError } from 'express-api-router'
import {
    getGameDirectory,
    getGameDirectoryPath,
    localizePath,
    refreshGameDirectory,
    sanitizeFilePath
} from '../../../utils'
import path from 'path'
import decompress from 'decompress'

export function uncompressGameDirectoryFileHandler(router: APIRouter) {
    return router.createRouteHandler({
        authed: true,
        bodySchema: z.object({
            filepath: z.string()
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

            const filepath = localizePath(req.body.filepath)
            const files = await instances.database
                .select()
                .from(filesTable)
                .where(
                    and(
                        eq(filesTable.game_directory, gameDirectory.name),
                        eq(filesTable.filepath, filepath)
                    )
                )
            if (files.length === 0) throw new HTTPError(404, 'file not found')
            const file = files[0]

            if (file.is_directory) {
                throw new HTTPError(500, 'cannot uncompress a directory')
            }
            const gameDirectoryPath = getGameDirectoryPath(
                instances.staticDirectory,
                gameDirectory
            )
            const diskFilePath = sanitizeFilePath(
                file.filepath,
                gameDirectoryPath
            )
            const splitedFilePath = file.filepath.split(path.sep)
            const containingDirectory = splitedFilePath
                .slice(0, splitedFilePath.length - 1)
                .join(path.sep)
            const containingDirectoryPath = sanitizeFilePath(
                containingDirectory,
                gameDirectoryPath
            )

            console.log(diskFilePath)
            console.log(containingDirectoryPath)

            await decompress(diskFilePath, containingDirectoryPath)
            await refreshGameDirectory(
                instances.staticDirectory,
                instances.database,
                gameDirectory
            )
        }
    })
}
