import { z } from 'zod'
import { APIRouter } from '../../web-api'
import { HTTPError } from 'express-api-router'
import {
    APIInstances,
    createArchive,
    DatabaseGameDirectory,
    getGameDirectory,
    getGameDirectoryPath,
    sanitizeFilePath,
    sendFile
} from '../../../utils'
import path from 'path'
import fs from 'fs'
import { gameDirectoriesTable } from '../../../db/schema'
import { eq } from 'drizzle-orm'

export function getGameDirectoryTarballHandler(router: APIRouter) {
    return router.createRouteHandler({
        authed: true,
        bodySchema: z.undefined(),
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
