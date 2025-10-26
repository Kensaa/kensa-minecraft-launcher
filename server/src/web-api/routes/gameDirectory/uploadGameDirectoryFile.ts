import { z } from 'zod'
import { APIRouter } from '../../web-api'
import { filesTable } from '../../../db/schema'
import { and, eq } from 'drizzle-orm'
import { HTTPError } from 'express-api-router'
import path from 'path'
import fs from 'fs'
import {
    getGameDirectory,
    getGameDirectoryPath,
    sanitizeFilePath
} from '../../../utils'
import { hashFile } from 'utils'

export function uploadGameDirectoryFileHandler(router: APIRouter) {
    return router.createRouteHandler({
        authed: true,
        upload: {
            type: 'single',
            fieldName: 'file'
        },
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

            const gameDirectoryPath = getGameDirectoryPath(
                instances.staticDirectory,
                gameDirectory
            )

            const diskFilepath = sanitizeFilePath(
                req.body.filepath,
                gameDirectoryPath
            )

            // Delete file from the database if it already exists
            await instances.database
                .delete(filesTable)
                .where(
                    and(
                        eq(filesTable.game_directory, gameDirectory.name),
                        eq(filesTable.filepath, req.body.filepath)
                    )
                )

            const fileDirectory = path.parse(diskFilepath)
            fs.mkdirSync(fileDirectory.dir, { recursive: true })
            fs.writeFileSync(diskFilepath, req.file.buffer)
            const stat = fs.statSync(diskFilepath)

            await instances.database.insert(filesTable).values({
                filepath: req.body.filepath,
                game_directory: gameDirectory.name,
                last_modified: stat.mtime,
                hash: await hashFile(diskFilepath)
            })
        }
    })
}
