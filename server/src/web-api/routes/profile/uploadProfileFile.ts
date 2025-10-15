import { z } from 'zod'
import { APIRouter } from '../../web-api'
import { filesTable, profilesTable } from '../../../db/schema'
import { and, eq } from 'drizzle-orm'
import { HTTPError } from 'express-api-router'
import path from 'path'
import fs from 'fs'
import { hashFile, sanitizeFilePath } from '../../../utils'
import sanitize from 'sanitize-filename'

export function uploadProfileFileHandler(router: APIRouter) {
    return router.createRouteHandler({
        authed: true,
        upload: {
            type: 'single',
            fieldName: 'file'
        },
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

            // Delete file from the database if it already exists
            await instances.database
                .delete(filesTable)
                .where(
                    and(
                        eq(filesTable.profile_id, profile.id),
                        eq(filesTable.filepath, req.body.filepath)
                    )
                )

            const fileDirectory = path.parse(diskFilepath)
            fs.mkdirSync(fileDirectory.dir, { recursive: true })
            fs.writeFileSync(diskFilepath, req.file.buffer)
            const stat = fs.statSync(diskFilepath)

            await instances.database.insert(filesTable).values({
                filepath: req.body.filepath,
                profile_id: profile.id,
                last_modified: stat.mtime,
                hash: await hashFile(diskFilepath)
            })
        }
    })
}
