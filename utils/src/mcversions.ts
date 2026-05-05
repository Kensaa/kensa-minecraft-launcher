import semver from 'semver'
import electronFetch from 'electron-fetch'

export type MinecraftVersion = {
    version: string
    forgeVersions: ForgeVersion[]
    neoforgeVersions: string[]
}
export type ForgeVersion = {
    version: string
    latest: boolean
    recommended: boolean
}
export async function fetchMcVersions(
    fetchFn: typeof fetch | typeof electronFetch
) {
    const mcversions: MinecraftVersion[] = []
    const versionPromise = fetchFn(
        'https://launchermeta.mojang.com/mc/game/version_manifest_v2.json'
    )
        .then(res => res.json())
        .then(res => res.versions as any[])

    const forgePromise = fetchFn(
        'https://files.minecraftforge.net/net/minecraftforge/forge/maven-metadata.json'
    ).then(res => res.json() as Promise<Record<string, string[]>>)
    const forgePromotionPromise = fetchFn(
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

    const neoforgePromise = fetchFn(
        'https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge'
    )
        .then(res => res.json())
        .then(data => {
            const versions = data.versions as string[]
            const res: Map<string, string[]> = new Map()
            for (const version of versions) {
                const mcVersion = getMcVersionFromNeoForgeVersion(version)
                let arr: string[] = []
                if (res.has(mcVersion)) {
                    arr = res.get(mcVersion)!
                } else {
                    res.set(mcVersion, arr)
                }
                arr.push(version)
            }
            return Object.fromEntries(res.entries())
        })

    await Promise.all([
        versionPromise,
        forgePromise,
        forgePromotionPromise,
        neoforgePromise
    ]).then(
        ([
            versions,
            forgeVersionsMap,
            [recommended, latest],
            neoforgeVersionsMap
        ]) => {
            // console.log(versions, forgeVersionsMap, forgePromotion)
            for (const version of versions) {
                if (version.type !== 'release') continue

                const versionObj: MinecraftVersion = {
                    version: version.id,
                    forgeVersions: [],
                    neoforgeVersions: []
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

                const neoforgeVersions = neoforgeVersionsMap[version.id]
                if (neoforgeVersions !== undefined) {
                    // there are neoforge versions for this version
                    versionObj.neoforgeVersions = neoforgeVersions.reverse()
                }

                mcversions.push(versionObj)
            }
            mcversions.sort((a, b) => cmpVersions(a.version, b.version))
        }
    )
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

function getMcVersionFromNeoForgeVersion(versionString: string): string {
    const spl = versionString.split('.')
    // Handle the new versioning scheme first
    if (parseInt(spl[0]) >= 26) {
        // 26.1.0.X -> 26.1
        var mcVersion = spl[0] + '.' + spl[1]
        // 26.1.1.X -> 26.1.1
        if (spl[2] != '0') {
            mcVersion += '.' + spl[2]
        }

        // 26.1.0.0-alpha+snapshot-1
        const splitBySnapshotIdentifier = versionString.split('+')
        if (splitBySnapshotIdentifier.length == 2) {
            mcVersion += '-' + splitBySnapshotIdentifier[1]
        }
        return mcVersion
    }
    return '1.' + getFirstTwoVersionNumbers(versionString)
}

// Split on periods and use only the first two version numbers
// So 21.1.29 becomes 21.1 which is the prefix for NeoForge versions on that Minecraft version.
function getFirstTwoVersionNumbers(versionString: string) {
    let splitVersion = versionString.split('.')
    return `${splitVersion[0]}.${splitVersion[1]}`
}
