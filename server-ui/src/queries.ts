import type {
    FileTreeElement,
    GameDirectory,
    MinecraftVersion,
    Profile,
    Tree
} from 'utils'
import { address } from './config'

async function queryFetch<T>(address: string) {
    const res = await fetch(address, {
        method: 'GET',
        credentials: 'include'
    })

    if (!res.ok) {
        throw new Error(await res.text())
    }
    return (await res.json()) as T
}

function queryBuilder<T>(address: string) {
    return () => queryFetch<T>(address)
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

export const fetchGameDirectoriesFile = (
    gameDirectoryName: GameDirectory['name']
) =>
    queryFetch<Tree<FileTreeElement>>(
        `${address}/web-api/gameDirectory/${gameDirectoryName}/files`
    )

export const jsonHeaders = {
    headers: { 'Content-Type': 'application/json' }
}
