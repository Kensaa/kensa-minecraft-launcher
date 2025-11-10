import { z } from 'zod'
import { APIRouter } from '../../web-api'
import { filesTable } from '../../../db/schema'
import { and, eq, like } from 'drizzle-orm'
import { HTTPError } from 'express-api-router'
import fs from 'fs'
import {
    getGameDirectory,
    getGameDirectoryPath,
    sanitizeFilePath
} from '../../../utils'

export function deleteGameDirectoryFileHandler(router: APIRouter) {
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

            const filepath = req.body.filepath.trim()
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

            const gameDirectoryPath = getGameDirectoryPath(
                instances.staticDirectory,
                gameDirectory
            )
            const diskFilepath = sanitizeFilePath(filepath, gameDirectoryPath)

            if (!file.is_directory) {
                // The file we're deleting is a file
                fs.rmSync(diskFilepath)
                await instances.database
                    .delete(filesTable)
                    .where(
                        and(
                            eq(filesTable.game_directory, file.game_directory),
                            eq(filesTable.filepath, file.filepath),
                            eq(filesTable.is_directory, file.is_directory)
                        )
                    )
            } else {
                // The file we're deleting is a directory
                // So we delete the directory from the database, and every file that are contained into it
                fs.rmSync(diskFilepath, { recursive: true })
                await instances.database
                    .delete(filesTable)
                    .where(
                        and(
                            eq(filesTable.game_directory, file.game_directory),
                            eq(filesTable.filepath, file.filepath)
                        )
                    )
                // Delete subfiles
                await instances.database
                    .delete(filesTable)
                    .where(
                        and(
                            eq(filesTable.game_directory, file.game_directory),
                            like(filesTable.filepath, file.filepath + '/%')
                        )
                    )
            }
        }
    })
}
