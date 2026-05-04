import { z } from 'zod'
import { APIRouter } from '../launcher-api'
import { buildFileTree, getTreeSchema } from '../../utils'
import { filesTable, gameDirectoriesTable } from '../../db/schema'
import { Tree } from 'utils'
import { eq } from 'drizzle-orm'

export function getHashesLegacy(router: APIRouter) {
    // Returns the entire file tree (for legacy reasons)
    return router.createRouteHandler({
        authed: false,
        bodySchema: z.undefined(),
        paramsSchema: z.object(),
        querySchema: z.object(),
        responseSchema: getTreeSchema(z.string()),
        async handler(req, res, instances) {
            const tree: { gameFolders: Tree<string> } = { gameFolders: {} }
            const game_directories = await instances.database
                .select()
                .from(gameDirectoriesTable)

            for (const game_directory of game_directories) {
                const profileFiles = await instances.database
                    .select()
                    .from(filesTable)
                    .where(eq(filesTable.game_directory, game_directory.name))
                tree.gameFolders[game_directory.name] = buildFileTree(
                    profileFiles,
                    file => file.hash
                )
            }
            return tree
        }
    })
}
