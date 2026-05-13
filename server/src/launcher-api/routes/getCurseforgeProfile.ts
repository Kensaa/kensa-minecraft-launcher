import { z } from 'zod'
import { APIRouter } from '../launcher-api'
import {
    APIInstances,
    createArchive,
    DatabaseProfile,
    getCurseforgeFileFingerprint,
    getGameDirectory,
    getGameDirectoryPath,
    getProfile,
    removeExtension,
    sanitizeFilePath,
    sendFile
} from '../../utils'
import { curseforgeFingerprintsTable, profilesTable } from '../../db/schema'
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
                console.log('does not exist')
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

            await sendFile(res, curseforgeProfilePath, `${profile.name}.zip`)
        }
    })
}

interface CurseforgeFile {
    projectID: number
    fileID: number
    required: boolean
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
    const filesArray: CurseforgeFile[] = []
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

        const modDirectory = path.join(overrideDirectory, 'mods')
        if (fs.existsSync(modDirectory)) {
            // There is a directory called "mods", scan the file inside it to find if they are on curseforge

            const toFetchFingerprints: Record<number, string> = {}
            for (const file of fs.readdirSync(modDirectory)) {
                const modFile = path.join(modDirectory, file)
                const stat = fs.statSync(modFile)
                if (!stat.isFile()) continue

                const fingerprint = getCurseforgeFileFingerprint(modFile)
                // check if the fingerprint is cached in the server database
                const cachedFiles = await instances.database
                    .select()
                    .from(curseforgeFingerprintsTable)
                    .where(
                        eq(curseforgeFingerprintsTable.fingerprint, fingerprint)
                    )
                if (cachedFiles.length > 0) {
                    // if there is a match, check if the file was a match on fingerprint search
                    if (cachedFiles[0].match) {
                        // we found a curseforge file matching this one, delete it from the overrides directory and add it to the files array
                        filesArray.push({
                            required: true,
                            fileID: cachedFiles[0].fileID!,
                            projectID: cachedFiles[0].projectID!
                        })
                        fs.rmSync(modFile)
                    }
                } else {
                    // we never seen this file, add it to the list of file to send to the api
                    toFetchFingerprints[fingerprint] = modFile
                }
            }

            // if there is fingerprint to send to the curseforge API, send it
            if (Object.keys(toFetchFingerprints).length > 0) {
                const apiKey = Buffer.from(
                    process.env.CURSEFORGE_API_KEY_BASE64!,
                    'base64'
                ).toString()
                try {
                    const res = await fetch(
                        `https://api.curseforge.com/v1/fingerprints/432`,
                        {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'User-Agent': 'kensa-minecraft-launcher',
                                'x-api-key': apiKey
                            },
                            body: JSON.stringify({
                                fingerprints: Object.keys(toFetchFingerprints)
                            })
                        }
                    )
                    if (!res.ok) {
                        throw new HTTPError(
                            500,
                            'failed to access curseforge api'
                        )
                    }
                    const data = await res.json()
                    const matches = data.data.exactMatches
                    for (const match of matches) {
                        await instances.database
                            .insert(curseforgeFingerprintsTable)
                            .values({
                                match: true,
                                projectID: match.id,
                                fileID: match.file.id,
                                fingerprint: match.file.fileFingerprint
                            })

                        filesArray.push({
                            required: true,
                            projectID: match.id,
                            fileID: match.file.id
                        })
                        fs.rmSync(
                            toFetchFingerprints[match.file.fileFingerprint]
                        )
                    }
                    const nonMatches = [
                        ...data.data.partialMatches.map(
                            (e: any) => e.file.fileFingerprint
                        ),
                        ...(data.data.unmatchedFingerprints ?? [])
                    ]
                    for (const nonMatch of nonMatches) {
                        await instances.database
                            .insert(curseforgeFingerprintsTable)
                            .values({
                                match: false,
                                fingerprint: nonMatch
                            })
                    }
                } catch (err) {
                    if (Error.isError(err)) {
                        throw new HTTPError(
                            500,
                            'Failed to access the curseforge api : ' +
                                err.message
                        )
                    } else {
                        throw new HTTPError(
                            500,
                            'Failed to access the curseforge api'
                        )
                    }
                }
            }
        }
    } else {
        fs.mkdirSync(overrideDirectory)
    }

    const isModded = profile.forge_version !== undefined
    const modloader = profile.is_neoforge ? 'neoforge' : 'forge'
    const manifest = {
        minecraft: {
            version: profile.mc_version,
            modLoaders: isModded
                ? [
                      {
                          id: `${modloader}-${profile.forge_version}`,
                          primary: true
                      }
                  ]
                : undefined
        },
        manifestType: 'minecraftModpack',
        manifestVersion: 1,
        name: profile.name,
        version: '1.0.0',
        author: 'Kensa',
        files: filesArray,
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
