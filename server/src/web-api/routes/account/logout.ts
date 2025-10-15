import { z } from 'zod'
import { APIRouter } from '../../web-api'

export function logoutHandler(router: APIRouter) {
    return router.createRouteHandler({
        authed: true,
        bodySchema: z.undefined(),
        paramsSchema: z.object(),
        querySchema: z.object(),
        responseSchema: z.void(),
        handler(req, res, instances, userTokenData) {
            res.clearCookie('auth-token')
        }
    })
}
