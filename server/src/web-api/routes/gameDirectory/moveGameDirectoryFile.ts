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

            const oldFilepath = normalizePath(req.body.old_filepath)
            const newFilepath = normalizePath(req.body.new_filepath)

            const oldFiles = await instances.database
                .select()
                .from(filesTable)
                .where(
                    and(
                        eq(filesTable.game_directory, gameDirectory.name),
                        eq(filesTable.filepath, oldFilepath)
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
                        eq(filesTable.filepath, newFilepath)
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
                oldFilepath,
                gameDirectoryPath
            )
            const newDiskFilepath = sanitizeFilePath(
                newFilepath,
                gameDirectoryPath
            )
            fs.renameSync(oldDiskFilepath, newDiskFilepath)
            const stat = fs.statSync(newDiskFilepath)

            if (!oldFile.is_directory) {
                await instances.database
                    .update(filesTable)
                    .set({
                        filepath: newFilepath,
                        last_modified: stat.mtime
                    })
                    .where(
                        and(
                            eq(
                                filesTable.game_directory,
                                oldFile.game_directory
                            ),
                            eq(filesTable.filepath, oldFile.filepath)
                        )
                    )
            } else {
                const files = await instances.database
                    .select()
                    .from(filesTable)
                    .where(
                        and(
                            eq(
                                filesTable.game_directory,
                                oldFile.game_directory
                            ),
                            like(filesTable.filepath, oldFile.filepath + '%')
                        )
                    )
                for (const file of files) {
                    const newPath = `${newFilepath}${file.filepath.substring(
                        oldFile.filepath.length
                    )}`

                    await instances.database
                        .update(filesTable)
                        .set({
                            filepath: newPath
                        })
                        .where(
                            and(
                                eq(
                                    filesTable.game_directory,
                                    gameDirectory.name
                                ),
                                eq(filesTable.filepath, file.filepath)
                            )
                        )
                }
            }
        }
    })
}

/**
 * Removes any / at the end of a path
 * @param filepath the path
 */
function normalizePath(filepath: string): string {
    if (filepath.endsWith('/')) {
        return filepath.substring(0, filepath.indexOf('/'))
    }
    return filepath
}
