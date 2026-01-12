import { z } from 'zod'
import { APIRouter } from '../launcher-api'
import { getGameDirectory } from '../../utils'
import { filesTable } from '../../db/schema'
import { count, eq } from 'drizzle-orm'
import { HTTPError } from 'express-api-router'

export function getFileCount(router: APIRouter) {
    return router.createRouteHandler({
        authed: false,
        bodySchema: z.undefined(),
        paramsSchema: z.object({
            game_directory: z.string()
        }),
        querySchema: z.object(),
        responseSchema: z.object({
            count: z.number()
        }),
        async handler(req, res, instances) {
            const game_directory = await getGameDirectory(
                instances.database,
                req.params.game_directory
            )
            if (!game_directory)
                throw new HTTPError(404, 'game directory not found')

            const files = await instances.database
                .select({ count: count() })
                .from(filesTable)
                .where(eq(filesTable.game_directory, game_directory.name))
            return files[0]
        }
    })
}
