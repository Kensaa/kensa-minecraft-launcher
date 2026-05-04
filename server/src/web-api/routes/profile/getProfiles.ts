import { z } from 'zod'
import { APIRouter } from '../../web-api'
import { profilesTable } from '../../../db/schema'

export function getProfilesHandler(router: APIRouter) {
    return router.createRouteHandler({
        authed: true,
        bodySchema: z.undefined(),
        paramsSchema: z.object(),
        querySchema: z.object(),
        responseSchema: z
            .object({
                id: z.number(),
                name: z.string(),
                version: z.object({
                    mc: z.string(),
                    forge: z.string().optional()
                }),
                gameDirectory: z.string().optional()
            })
            .array(),
        async handler(req, res, instances, userTokenData) {
            const profiles = await instances.database
                .select()
                .from(profilesTable)

            return profiles.map(profile => ({
                id: profile.id,
                name: profile.name,
                version: {
                    mc: profile.mc_version,
                    forge: profile.forge_version ?? undefined
                },
                gameDirectory: profile.game_directory ?? undefined
            }))
        }
    })
}
