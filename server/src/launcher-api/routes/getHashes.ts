import { z } from 'zod'
import { APIRouter } from '../launcher-api'
import { buildFileTree, getGameDirectory, getTreeSchema } from '../../utils'
import { filesTable } from '../../db/schema'
import { eq } from 'drizzle-orm'
import { HTTPError } from 'express-api-router'

export function getHashes(router: APIRouter) {
    return router.createRouteHandler({
        authed: false,
        bodySchema: z.undefined(),
        paramsSchema: z.object({
            game_directory: z.string()
        }),
        querySchema: z.object(),
        responseSchema: getTreeSchema(z.string()),
        async handler(req, res, instances) {
            const game_directory = await getGameDirectory(
                instances.database,
                req.params.game_directory
            )
            if (!game_directory)
                throw new HTTPError(404, 'game directory not found')

            const profileFiles = await instances.database
                .select()
                .from(filesTable)
                .where(eq(filesTable.game_directory, game_directory.name))
            return buildFileTree(profileFiles, file => file.hash)
        }
    })
}
