import { z } from 'zod'
import { APIRouter } from '../../web-api'
import { gameDirectoriesTable } from '../../../db/schema'

export function getGameDirectories(router: APIRouter) {
    return router.createRouteHandler({
        authed: true,
        bodySchema: z.undefined(),
        paramsSchema: z.object(),
        querySchema: z.object(),
        responseSchema: z
            .object({
                name: z.string()
            })
            .array(),
        async handler(req, res, instances, userTokenData) {
            const gameDirectories = await instances.database
                .select()
                .from(gameDirectoriesTable)

            return gameDirectories
        }
    })
}
