import { z } from 'zod'
import { APIRouter } from '../launcher-api'
import {
    APIInstances,
    createArchive,
    DatabaseGameDirectory,
    getGameDirectory,
    getGameDirectoryPath,
    removeExtension,
    sanitizeFilePath,
    sendFile
} from '../../utils'
import { eq } from 'drizzle-orm'
import { HTTPError } from 'express-api-router'
import fs from 'fs'
import path from 'path'
import { gameDirectoriesTable } from '../../db/schema'

export function getTarball(router: APIRouter) {
    return router.createRouteHandler({
        authed: false,
        bodySchema: z.undefined(),
        paramsSchema: z.object({
            game_directory: z.string()
        }),
        querySchema: z.object(),
        responseSchema: z.void(),
        async handler(req, res, instances) {
            // For legacy reasons, game_directory can sometimes be the entire name of the tarball (with its extension), in that case we remove it to get only the name of the game directory
            const gameDirectoryName = removeExtension(
                req.params.game_directory.trim(),
                '.tar.gz'
            )

            const gameDirectory = await getGameDirectory(
                instances.database,
                gameDirectoryName
            )
            if (!gameDirectory)
                throw new HTTPError(404, 'game directory not found')

            if (gameDirectory.tarball_created_at) {
                // There is a tarball
                if (
                    gameDirectory.tarball_created_at! <
                    gameDirectory.last_modified
                ) {
                    // game directory was modified after the tarball was created => recreate it
                    await createTarball(instances, gameDirectory)
                }
            } else {
                // There is no tarball => create it
                await createTarball(instances, gameDirectory)
            }

            const tarballDirectory = path.join(
                instances.staticDirectory,
                'tarballs'
            )
            const tarballPath = sanitizeFilePath(
                `${gameDirectory.name}.tar.gz`,
                tarballDirectory
            )

            await sendFile(res, tarballPath)
        }
    })
}

async function createTarball(
    instances: APIInstances,
    gameDirectory: DatabaseGameDirectory
) {
    const tarballDirectory = path.join(instances.staticDirectory, 'tarballs')
    if (!fs.existsSync(tarballDirectory)) {
        fs.mkdirSync(tarballDirectory)
    }
    const gameDirectoryPath = getGameDirectoryPath(
        instances.staticDirectory,
        gameDirectory
    )

    const tarballPath = sanitizeFilePath(
        `${gameDirectory.name}.tar.gz`,
        tarballDirectory
    )

    await createArchive('tar', gameDirectoryPath, tarballPath, false)
    await instances.database
        .update(gameDirectoriesTable)
        .set({
            tarball_created_at: new Date()
        })
        .where(eq(gameDirectoriesTable.name, gameDirectory.name))
}
