import { z } from 'zod'
import { APIRouter } from '../../web-api'
import { profilesTable } from '../../../db/schema'
import { eq } from 'drizzle-orm'
import { HTTPError } from 'express-api-router'
import { refreshProfile } from '../../../utils'

export function refreshProfileHandler(router: APIRouter) {
    return router.createRouteHandler({
        authed: true,
        bodySchema: z.undefined(),
        paramsSchema: z.object({
            profile_id: z.string()
        }),
        querySchema: z.object(),
        responseSchema: z.void(),
        async handler(req, res, instances, userTokenData) {
            const profile_id = parseInt(req.params.profile_id)
            if (Number.isNaN(profile_id))
                throw new HTTPError(400, 'invalid profile id')

            const profiles = await instances.database
                .select()
                .from(profilesTable)
                .where(eq(profilesTable.id, profile_id))

            if (profiles.length === 0)
                throw new HTTPError(404, 'profile not found')
            const profile = profiles[0]

            await refreshProfile(
                instances.staticDirectory,
                instances.database,
                profile
            )
        }
    })
}
