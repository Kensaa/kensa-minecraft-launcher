import { z } from 'zod'
import { APIRouter } from '../launcher-api'
import {
    APIInstances,
    createArchive,
    DatabaseGameDirectory,
    DatabaseProfile,
    getGameDirectory,
    getGameDirectoryPath,
    getProfile,
    removeExtension,
    sanitizeFilePath,
    sendFile
} from '../../utils'
import { profilesTable } from '../../db/schema'
import { eq } from 'drizzle-orm'
import { HTTPError } from 'express-api-router'
import fs from 'fs'
import path from 'path'
import { tmpdir } from 'os'

export function getCurseforgeProfile(router: APIRouter) {
    return router.createRouteHandler({
        authed: false,
        bodySchema: z.undefined(),
        paramsSchema: z.object({
            profile: z.string()
        }),
        querySchema: z.object(),
        responseSchema: z.void(),
        async handler(req, res, instances) {
            const profile_id = parseInt(req.params.profile)
            let profile
            if (Number.isNaN(profile_id)) {
                // For legacy reasons, profile_id can sometimes be "name.zip", in that case we remove it to get only the name of the profile, and try to find its id
                const profileName = removeExtension(
                    req.params.profile.trim(),
                    '.zip'
                )
                const res = await instances.database
                    .select()
                    .from(profilesTable)
                    .where(eq(profilesTable.name, profileName))
                profile = res[0]
            } else {
                profile = await getProfile(instances.database, profile_id)
            }
            if (!profile) throw new HTTPError(404, 'profile not found')

            const game_directory = profile.game_directory
                ? await getGameDirectory(
                      instances.database,
                      profile.game_directory
                  )
                : undefined

            if (profile.curseforge_profile_created_at) {
                // There is a curseforge profile
                if (
                    profile.curseforge_profile_created_at <
                    profile.last_modified
                ) {
                    // The profile was modified since the last curseforge profile creation
                    await createCurseforgeProfile(instances, profile)
                } else {
                    if (game_directory) {
                        // The profile has a game directory
                        if (
                            profile.curseforge_profile_created_at <
                            game_directory.last_modified
                        ) {
                            // the profile's game directory was modified since the last curseforge profile creation
                            await createCurseforgeProfile(instances, profile)
                        }
                    }
                }
            } else {
                // The curseforge profile doesn't exist
                await createCurseforgeProfile(instances, profile)
            }

            const curseforgeProfileDirectory = path.join(
                instances.staticDirectory,
                'curseforgeProfiles'
            )
            const curseforgeProfilePath = sanitizeFilePath(
                `${profile.id}.zip`,
                curseforgeProfileDirectory
            )

            await sendFile(res, curseforgeProfilePath)
        }
    })
}

async function createCurseforgeProfile(
    instances: APIInstances,
    profile: DatabaseProfile
) {
    const curseforgeProfileDirectory = path.join(
        instances.staticDirectory,
        'curseforgeProfiles'
    )
    if (!fs.existsSync(curseforgeProfileDirectory)) {
        fs.mkdirSync(curseforgeProfileDirectory)
    }
    const curseforgeProfilePath = path.join(
        curseforgeProfileDirectory,
        profile.id + '.zip'
    )
    const tempDirectory = fs.mkdtempSync(
        path.join(tmpdir(), `curseforgeProfile-${profile.id}-`)
    )
    const overrideDirectory = path.join(tempDirectory, 'overrides')
    if (profile.game_directory) {
        const gameDirectory = await getGameDirectory(
            instances.database,
            profile.game_directory
        )
        if (!gameDirectory)
            throw new HTTPError(
                500,
                'specified profile has a game_directory, but it cannot be found in the database'
            )
        fs.cpSync(
            getGameDirectoryPath(instances.staticDirectory, gameDirectory),
            overrideDirectory,
            { recursive: true }
        )
        const manifest = {
            minecraft: {
                version: profile.mc_version,
                modLoaders: profile.forge_version
                    ? [
                          {
                              id: `forge-${profile.forge_version}`,
                              primary: true
                          }
                      ]
                    : undefined
            },
            manifestType: 'minecraftModpack',
            manifestVersion: 1,
            name: profile.name,
            version: '',
            author: '',
            files: [],
            overrides: 'overrides'
        }
        fs.writeFileSync(
            path.join(tempDirectory, 'manifest.json'),
            JSON.stringify(manifest, null, 2)
        )
        await createArchive('zip', tempDirectory, curseforgeProfilePath, true)
        fs.rmSync(tempDirectory, { recursive: true })
        await instances.database
            .update(profilesTable)
            .set({
                curseforge_profile_created_at: new Date()
            })
            .where(eq(profilesTable.id, profile.id))
    }
}
