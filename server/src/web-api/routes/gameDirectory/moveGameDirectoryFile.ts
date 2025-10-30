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
import { hashFile } from 'utils'

export function moveGameDirectoryFileHandler(router: APIRouter) {
    return router.createRouteHandler({
        authed: true,
        bodySchema: z.object({
            old_filepath: z.string(),
            new_filepath: z.string()
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

            const oldFiles = await instances.database
                .select()
                .from(filesTable)
                .where(
                    and(
                        eq(filesTable.game_directory, gameDirectory.name),
                        eq(filesTable.filepath, req.body.old_filepath)
                    )
                )
            if (oldFiles.length === 0)
                throw new HTTPError(404, 'file to move not found')
            const oldFile = oldFiles[0]

            const newFiles = await instances.database
                .select()
                .from(filesTable)
                .where(
                    and(
                        eq(filesTable.game_directory, gameDirectory.name),
                        eq(filesTable.filepath, req.body.new_filepath)
                    )
                )
            if (newFiles.length > 0)
                throw new HTTPError(
                    409,
                    'there is already a file with that path'
                )

            const gameDirectoryPath = getGameDirectoryPath(
                instances.staticDirectory,
                gameDirectory
            )
            const oldDiskFilepath = sanitizeFilePath(
                req.body.old_filepath,
                gameDirectoryPath
            )
            const newDiskFilepath = sanitizeFilePath(
                req.body.new_filepath,
                gameDirectoryPath
            )
            fs.renameSync(oldDiskFilepath, newDiskFilepath)
            const stat = fs.statSync(newDiskFilepath)

            await instances.database
                .update(filesTable)
                .set({
                    filepath: req.body.new_filepath,
                    hash: await hashFile(newDiskFilepath),
                    last_modified: stat.mtime
                })
                .where(
                    and(
                        eq(filesTable.game_directory, oldFile.game_directory),
                        eq(filesTable.filepath, oldFile.filepath)
                    )
                )
        }
    })
}
