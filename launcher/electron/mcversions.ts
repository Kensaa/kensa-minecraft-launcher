import semver, { compare } from 'semver'
import fetch from 'electron-fetch'
import { ForgeVersion, Version } from '../src/types'

export async function fetchMcVersions() {
    const mcversions: Version[] = []
    const versionPromise = fetch(
        'https://launchermeta.mojang.com/mc/game/version_manifest_v2.json'
    )
        .then(res => res.json())
        .then(res => res.versions as any[])

    const forgePromise = fetch(
        'https://files.minecraftforge.net/net/minecraftforge/forge/maven-metadata.json'
    ).then(res => res.json() as Promise<Record<string, string[]>>)
    const forgePromotionPromise = fetch(
        'https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json'
    )
        .then(res => res.json())
        .then(res => {
            const recommended: string[] = []
            const latest: string[] = []
            for (const [k, v] of Object.entries(res.promos)) {
                if (k.endsWith('recommended')) {
                    recommended.push(v as string)
                }
                if (k.endsWith('latest')) {
                    latest.push(v as string)
                }
            }
            return [recommended, latest]
        })

    await Promise.all([
        versionPromise,
        forgePromise,
        forgePromotionPromise
    ]).then(([versions, forgeVersionsMap, [recommended, latest]]) => {
        // console.log(versions, forgeVersionsMap, forgePromotion)
        for (const version of versions) {
            if (version.type !== 'release') continue

            const versionObj: Version = {
                version: version.id,
                forgeVersions: []
            }
            const forgeVersions = forgeVersionsMap[version.id]
            if (forgeVersions !== undefined) {
                // there are forge versions for this version
                for (let forgeVersion of forgeVersions) {
                    // We remove the minecraft version from the start of the forge version
                    if (forgeVersion.startsWith(version.id + '-')) {
                        forgeVersion = forgeVersion.substring(
                            forgeVersion.indexOf('-') + 1
                        )
                    }
                    if (!isVersionValid(forgeVersion)) {
                        continue
                    }
                    const forgeVersionObj: ForgeVersion = {
                        version: forgeVersion,
                        latest: latest.includes(forgeVersion),
                        recommended: recommended.includes(forgeVersion)
                    }

                    versionObj.forgeVersions.push(forgeVersionObj)
                }
                versionObj.forgeVersions.sort((a, b) => {
                    if (a.recommended == b.recommended) {
                        if (a.latest == b.latest) {
                            return cmpVersions(a.version, b.version)
                        } else {
                            return a.latest ? -1 : 1
                        }
                    } else {
                        return a.recommended ? -1 : 1
                    }
                })
            }

            mcversions.push(versionObj)
        }
        mcversions.sort((a, b) => cmpVersions(a.version, b.version))
    })
    return mcversions
}

function cmpVersions(a: string, b: string): -1 | 0 | 1 {
    // replace a.b.c.d (forge versions) ==> a.b.c-d
    a = normalizeVersion(a)
    b = normalizeVersion(b)
    return semver.compare(a, b)
}

function normalizeVersion(version: string): string {
    // normalize
    //  a.b => a.b.0
    //  a.b.c => a.b.c
    //  a.b.c.d => a.b.c-d
    //  a.b.c.d-e => a.b.c-d.e

    const reg = /^(\d+)\.(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-(\d+))?$/
    const matches = reg.exec(version)
    if (matches) {
        if (matches[5]) {
            return `${matches[1]}.${matches[2]}.${matches[3]}-${matches[4]}.${matches[5]}`
        } else if (matches[4]) {
            return `${matches[1]}.${matches[2]}.${matches[3]}-${matches[4]}`
        } else if (matches[3]) {
            return `${matches[1]}.${matches[2]}.${matches[3]}`
        } else if (matches[2]) {
            return `${matches[1]}.${matches[2]}.0`
        } else if (semver.valid(version)) {
            return version
        }
        throw new Error('invalid version: ' + version)
    } else if (semver.valid(version)) {
        return version
    }
    throw new Error('invalid version: ' + version)
}

function isVersionValid(version: string): boolean {
    try {
        normalizeVersion(version)
        return true
    } catch {
        return false
    }
}
