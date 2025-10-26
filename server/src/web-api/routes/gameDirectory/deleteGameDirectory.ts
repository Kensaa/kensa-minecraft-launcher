import { z } from 'zod'
import { APIRouter } from '../../web-api'
import {
    filesTable,
    gameDirectoriesTable,
    profilesTable
} from '../../../db/schema'
import { count, eq } from 'drizzle-orm'
import { HTTPError } from 'express-api-router'
import { getGameDirectoryPath } from '../../../utils'
import fs from 'fs'

export function deleteGameDirectoryHandler(router: APIRouter) {
    return router.createRouteHandler({
        authed: true,
        bodySchema: z.undefined(),
        paramsSchema: z.object({
            game_directory: z.string()
        }),
        querySchema: z.object(),
        responseSchema: z.void(),
        async handler(req, res, instances, userTokenData) {
            // Check if any profile uses this game directory
            const profiles = await instances.database
                .select({ count: count() })
                .from(profilesTable)
                .where(
                    eq(profilesTable.game_directory, req.params.game_directory)
                )
            if (profiles[0].count !== 0) {
                throw new HTTPError(
                    409,
                    'cannot delete the game directory because there are profiles using it'
                )
            }

            // Delete game directory files from the database
            await instances.database
                .delete(filesTable)
                .where(eq(filesTable.game_directory, req.params.game_directory))

            // Delete game directory from the database
            const gameDirectoryDeleteResult = await instances.database
                .delete(gameDirectoriesTable)
                .where(eq(gameDirectoriesTable.name, req.params.game_directory))
                .returning()

            if (gameDirectoryDeleteResult.length === 0)
                throw new HTTPError(404, 'profile not found')

            // Delete files from disk
            const gameDirectoryPath = getGameDirectoryPath(
                instances.staticDirectory,
                gameDirectoryDeleteResult[0]
            )
            fs.rmSync(gameDirectoryPath, { recursive: true, force: true })
        }
    })
}
