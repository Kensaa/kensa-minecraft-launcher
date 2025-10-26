import { z } from 'zod'
import { APIRouter } from '../../web-api'
import { gameDirectoriesTable, profilesTable } from '../../../db/schema'
import { count, eq } from 'drizzle-orm'
import { HTTPError } from 'express-api-router'
import { getGameDirectory } from '../../../utils'

export function createProfileHandler(router: APIRouter) {
    return router.createRouteHandler({
        authed: true,
        bodySchema: z.object({
            name: z.string(),
            mcVersion: z.string(),
            forgeVersion: z.string().optional(),
            gameDirectory: z.string().optional()
        }),
        paramsSchema: z.object(),
        querySchema: z.object(),
        responseSchema: z.void(),
        async handler(req, res, instances, userTokenData) {
            if (
                (
                    await instances.database
                        .select({ count: count() })
                        .from(profilesTable)
                        .where(eq(profilesTable.name, req.body.name))
                )[0].count !== 0
            ) {
                throw new HTTPError(409, 'profile already exists')
            }

            if (req.body.gameDirectory) {
                const gameDirectory = await getGameDirectory(
                    instances.database,
                    req.body.gameDirectory
                )
                if (!gameDirectory) {
                    throw new HTTPError(404, 'game directory does not exist')
                }
            }
            await instances.database.insert(profilesTable).values({
                name: req.body.name,
                mc_version: req.body.mcVersion,
                forge_version: req.body.forgeVersion,
                game_directory: req.body.gameDirectory
            })
        }
    })
}
