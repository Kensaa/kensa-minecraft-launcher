import { z } from 'zod'
import { APIRouter } from '../../web-api'
import { profilesTable } from '../../../db/schema'
import { eq } from 'drizzle-orm'
import { HTTPError } from 'express-api-router'

export function deleteProfileHandler(router: APIRouter) {
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

            const deleteResult = await instances.database
                .delete(profilesTable)
                .where(eq(profilesTable.id, profile_id))

            if (deleteResult.changes === 0)
                throw new HTTPError(404, 'profile not found')
        }
    })
}
