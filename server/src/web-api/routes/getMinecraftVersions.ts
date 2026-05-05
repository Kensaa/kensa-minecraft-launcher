import { z } from 'zod'
import { APIRouter } from '../web-api'
import { fetchMcVersions } from 'utils'

export function getMinecraftVersionHandler(router: APIRouter) {
    return router.createRouteHandler({
        authed: false,
        bodySchema: z.undefined(),
        paramsSchema: z.object(),
        querySchema: z.object(),
        responseSchema: z
            .object({
                version: z.string(),
                forgeVersions: z
                    .object({
                        version: z.string(),
                        latest: z.boolean(),
                        recommended: z.boolean()
                    })
                    .array(),
                neoforgeVersions: z.string().array()
            })
            .array(),
        async handler(req, res, instances) {
            return await fetchMcVersions(fetch)
        }
    })
}
