import { z } from 'zod'
import { APIRouter } from '../launcher-api'
import { profilesTable } from '../../db/schema'

export function getProfilesHandler(router: APIRouter) {
    return router.createRouteHandler({
        authed: false,
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
                gameFolder: z.string().optional(),
                gameDirectory: z.string().optional()
            })
            .array(),
        async handler(req, res, instances) {
            const profiles = await instances.database
                .select()
                .from(profilesTable)

            const reformattedProfiles = profiles.map(profile => ({
                id: profile.id,
                name: profile.name,
                version: {
                    mc: profile.mc_version,
                    forge: profile.forge_version ?? undefined
                },
                gameFolder: profile.game_directory ?? undefined, // for backward compat
                gameDirectory: profile.game_directory ?? undefined
            }))

            return reformattedProfiles
        }
    })
}
