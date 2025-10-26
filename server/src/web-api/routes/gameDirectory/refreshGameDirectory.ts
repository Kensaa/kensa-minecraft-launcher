import { z } from 'zod'
import { APIRouter } from '../../web-api'
import { HTTPError } from 'express-api-router'
import { getGameDirectory, refreshGameDirectory } from '../../../utils'

export function refreshGameDirectoryHandler(router: APIRouter) {
    return router.createRouteHandler({
        authed: true,
        bodySchema: z.undefined(),
        paramsSchema: z.object({
            game_directory: z.string()
        }),
        querySchema: z.object(),
        responseSchema: z.void(),
        async handler(req, res, instances, userTokenData) {
            const gameDirectory = await getGameDirectory(
                instances.database,
                req.params.game_directory
            )
            if (!gameDirectory)
                throw new HTTPError(404, 'game directory not found')

            await refreshGameDirectory(
                instances.staticDirectory,
                instances.database,
                gameDirectory
            )
        }
    })
}
