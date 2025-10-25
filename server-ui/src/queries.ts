import { address } from './config'
import type { Profile } from './types'

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
