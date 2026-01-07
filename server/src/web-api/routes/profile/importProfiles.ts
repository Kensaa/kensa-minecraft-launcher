import { z } from 'zod'
import { APIRouter } from '../../web-api'
import { gameDirectoriesTable, profilesTable } from '../../../db/schema'
import { count, eq } from 'drizzle-orm'
import { getGameDirectory } from '../../../utils'
import { HTTPError } from 'express-api-router'

export function importProfilesHandler(router: APIRouter) {
    return router.createRouteHandler({
        authed: true,
        bodySchema: z
            .object({
                name: z.string(),
                version: z.object({
                    mc: z.string(),
                    forge: z.string().optional()
                }),
                gameFolder: z.string().optional()
            })
            .array(),
        paramsSchema: z.object(),
        querySchema: z.object(),
        responseSchema: z.void(),
        async handler(req, res, instances, userTokenData) {
            for (const profile of req.body) {
                const existingProfile = await instances.database
                    .select({ count: count() })
                    .from(profilesTable)
                    .where(eq(profilesTable.name, profile.name))
                if (existingProfile[0].count !== 0) {
                    // if there is a profile with the same name, skip it
                    continue
                }

                if (profile.gameFolder) {
                    const gameDirectory = await getGameDirectory(
                        instances.database,
                        profile.gameFolder.trim()
                    )
                    if (!gameDirectory) {
                        // if game directory does not exist, create it
                        await instances.database
                            .insert(gameDirectoriesTable)
                            .values({
                                name: profile.gameFolder.trim()
                            })
                    }
                }

                // if forge version exists, check if it is the old format (installer path)
                let forge_version: string | undefined
                if (profile.version.forge !== undefined) {
                    if (profile.version.forge.endsWith('.jar')) {
                        // this is probably bad because not every forge version are three integers like this (see mcversions.ts)
                        const reg = /(\d+.\d+.\d+(?:\.\d+)?)/g
                        const matches = profile.version.forge.match(reg)
                        if (!matches) {
                            throw new HTTPError(
                                400,
                                `Could not find the forge version out of the string '${profile.version.forge}' (profile : ${profile.name})`
                            )
                        }
                        // the forge version should be the last match
                        forge_version = matches[matches.length - 1]
                    } else {
                        forge_version = profile.version.forge
                    }
                }
                await instances.database.insert(profilesTable).values({
                    name: profile.name.trim(),
                    mc_version: profile.version.mc,
                    forge_version,
                    game_directory: profile.gameFolder
                        ? profile.gameFolder.trim()
                        : undefined
                })
            }
        }
    })
}
