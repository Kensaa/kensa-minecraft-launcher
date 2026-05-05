import { z } from 'zod'
import { APIRouter } from '../../web-api'
import { profilesTable } from '../../../db/schema'
import { eq } from 'drizzle-orm'
import { HTTPError } from 'express-api-router'
import { getGameDirectory, getProfile } from '../../../utils'

export function updateProfileHandler(router: APIRouter) {
    return router.createRouteHandler({
        authed: true,
        bodySchema: z.object({
            name: z.string(),
            mcVersion: z.string(),
            isNeoforge: z.boolean(),
            forgeVersion: z.string().optional(),
            gameDirectory: z.string().optional(),
            hidden: z.boolean()
        }),
        paramsSchema: z.object({
            profile_id: z.string()
        }),
        querySchema: z.object(),
        responseSchema: z.void(),
        async handler(req, res, instances, userTokenData) {
            const profile_id = parseInt(req.params.profile_id)
            if (Number.isNaN(profile_id)) {
                throw new HTTPError(400, 'invalid profile id')
            }
            const profile = await getProfile(instances.database, profile_id)
            if (!profile) {
                throw new HTTPError(404, 'profile not found')
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

            const updateRes = await instances.database
                .update(profilesTable)
                .set({
                    name: req.body.name,
                    mc_version: req.body.mcVersion,
                    is_neoforge: req.body.isNeoforge,
                    forge_version: req.body.forgeVersion ?? null,
                    game_directory: req.body.gameDirectory ?? null,
                    hidden: req.body.hidden,
                    last_modified: new Date()
                })
                .where(eq(profilesTable.id, profile.id))

            if (updateRes.changes === 0)
                throw new HTTPError(500, 'failed to update profile')
        }
    })
}
