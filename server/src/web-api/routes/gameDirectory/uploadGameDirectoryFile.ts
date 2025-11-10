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

            const filepath = req.body.filepath.trim()
            const diskFilepath = sanitizeFilePath(filepath, gameDirectoryPath)

            // Delete file from the database if it already exists
            await instances.database
                .delete(filesTable)
                .where(
                    and(
                        eq(filesTable.game_directory, gameDirectory.name),
                        eq(filesTable.filepath, filepath)
                    )
                )

            const fileDirectory = path.parse(diskFilepath)
            fs.mkdirSync(fileDirectory.dir, { recursive: true })
            fs.writeFileSync(diskFilepath, req.file.buffer)
            const stat = fs.statSync(diskFilepath)

            const insertedFile = await instances.database
                .insert(filesTable)
                .values({
                    filepath: filepath,
                    game_directory: gameDirectory.name,
                    last_modified: stat.mtime,
                    hash: await hashFile(diskFilepath)
                })
                .returning({ filepath: filesTable.filepath })

            if (insertedFile.length === 0)
                throw new HTTPError(
                    500,
                    'an error occured while inserting file into the database'
                )

            return insertedFile[0]
        }
    })
}
