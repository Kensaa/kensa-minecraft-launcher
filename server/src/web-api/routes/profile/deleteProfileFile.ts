import { z } from 'zod'
import { APIRouter } from '../../web-api'
import { filesTable, profilesTable } from '../../../db/schema'
import { and, eq } from 'drizzle-orm'
import { HTTPError } from 'express-api-router'
import path from 'path'
import fs from 'fs'
import { sanitizeFilePath } from '../../../utils'

export function deleteProfileFileHandler(router: APIRouter) {
    return router.createRouteHandler({
        authed: true,
        bodySchema: z.object({
            filepath: z.string()
        }),
        paramsSchema: z.object({
            profile_id: z.string()
        }),
        querySchema: z.object(),
        responseSchema: z.void(),
        async handler(req, res, instances, userTokenData) {
            const profile_id = parseInt(req.params.profile_id)
            if (Number.isNaN(profile_id))
                throw new HTTPError(400, 'invalid profile id')

            const profiles = await instances.database
                .select()
                .from(profilesTable)
                .where(eq(profilesTable.id, profile_id))
            if (profiles.length === 0)
                throw new HTTPError(404, 'profile not found')
            const profile = profiles[0]

            const deleteResult = await instances.database
                .delete(filesTable)
                .where(
                    and(
                        eq(filesTable.profile_id, profile.id),
                        eq(filesTable.filepath, req.body.filepath)
                    )
                )

            if (!profile.game_directory)
                throw new HTTPError(
                    400,
                    'this profile does not have a gameDirectory'
                )

            const gameDirectory = path.join(
                instances.staticDirectory,
                'gameDirectories',
                profile.game_directory
            )

            const diskFilepath = sanitizeFilePath(
                req.body.filepath,
                gameDirectory
            )
            fs.rmSync(diskFilepath)

            if (deleteResult.changes === 0)
                throw new HTTPError(404, 'file not found')
        }
    })
}
