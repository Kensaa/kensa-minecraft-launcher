import { z } from 'zod'
import { APIRouter } from '../../web-api'
import { filesTable } from '../../../db/schema'
import { HTTPError } from 'express-api-router'
import { eq } from 'drizzle-orm'
import { buildFileTree, getGameDirectory, getTreeSchema } from '../../../utils'

const treeLeafSchema = z.object({
    lastModified: z.date(),
    hash: z.string()
})

export function getGameDirectoryFilesHandler(router: APIRouter) {
    return router.createRouteHandler({
        authed: true,
        bodySchema: z.undefined(),
        paramsSchema: z.object({
            game_directory: z.string()
        }),
        querySchema: z.object(),
        responseSchema: getTreeSchema(treeLeafSchema),
        async handler(req, res, instances, userTokenData) {
            const gameDirectory = await getGameDirectory(
                instances.database,
                req.params.game_directory
            )
            if (!gameDirectory)
                throw new HTTPError(404, 'game directory not found')

            const files = await instances.database
                .select()
                .from(filesTable)
                .where(eq(filesTable.game_directory, gameDirectory.name))

            const tree = buildFileTree(files, file => ({
                lastModified: file.last_modified,
                hash: file.hash
            }))

            return tree
        }
    })
}
