import { z } from 'zod'
import { APIRouter } from '../../web-api'
import { gameDirectoriesTable } from '../../../db/schema'
import { count, eq } from 'drizzle-orm'
import { HTTPError } from 'express-api-router'

export function createGameDirectoryHandler(router: APIRouter) {
    return router.createRouteHandler({
        authed: true,
        bodySchema: z.object({
            name: z.string()
        }),
        paramsSchema: z.object(),
        querySchema: z.object(),
        responseSchema: z.void(),
        async handler(req, res, instances, userTokenData) {
            if (
                (
                    await instances.database
                        .select({ count: count() })
                        .from(gameDirectoriesTable)
                        .where(eq(gameDirectoriesTable.name, req.body.name))
                )[0].count !== 0
            ) {
                throw new HTTPError(409, 'game directory already exists')
            }

            await instances.database.insert(gameDirectoriesTable).values({
                name: req.body.name
            })
        }
    })
}
