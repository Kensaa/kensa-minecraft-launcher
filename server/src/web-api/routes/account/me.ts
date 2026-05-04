import { z } from 'zod'
import { APIRouter } from '../../web-api'

export function meHandler(router: APIRouter) {
    return router.createRouteHandler({
        authed: true,
        bodySchema: z.undefined(),
        paramsSchema: z.object({}),
        querySchema: z.object({}),
        responseSchema: z.object({
            id: z.number(),
            username: z.string(),
            is_admin: z.boolean()
        }),
        handler: (req, res, instances, userTokenData) => {
            return userTokenData
        }
    })
}
