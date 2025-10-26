import type { GameDirectory, MinecraftVersion, Profile } from 'utils'
import { address } from './config'

function queryBuilder<T>(address: string) {
    return async function () {
        const res = await fetch(address, {
            method: 'GET',
            credentials: 'include'
        })

        if (!res.ok) {
            throw new Error(await res.text())
        }
        return (await res.json()) as T
    }
}

export const fetchProfiles = queryBuilder<Profile[]>(
    `${address}/web-api/profiles`
)

export const fetchMinecraftVersions = queryBuilder<MinecraftVersion[]>(
    `${address}/web-api/getMinecraftVersions`
)

export const fetchGameDirectories = queryBuilder<GameDirectory[]>(
    `${address}/web-api/gameDirectories`
)
