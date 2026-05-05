import { create } from 'zustand'
import { ipcRenderer } from 'electron'
import type { Profile } from '../types'
import { useMemo } from 'react'
import { useConfig } from './config'

const FETCH_TIMEOUT = 1500

interface ServerProfiles {
    address: string
    profiles: Profile[]
}

interface ProfileStore {
    remoteProfiles: Record<string, ServerProfiles>
    localProfiles: Profile[]
    fetching: boolean
    fetchRemoteProfiles: () => void
    setLocalProfiles: (profiles: ProfileStore['localProfiles']) => void

    //[server name, profile id]
    selectedProfile?: [string, number]
    setSelectedProfile: (profile: ProfileStore['selectedProfile']) => void
}

const useStore = create<ProfileStore>(set => {
    // If the list of servers change, we refetch the profiles
    useConfig.subscribe((config, prev) => {
        if (config.servers !== prev.servers) {
            fetchRemoteProfiles()
        }
    })

    const fetchRemoteProfiles = async () => {
        set({ fetching: true })
        const servers = useConfig.getState().servers

        const seenServers: Set<string> = new Set()

        const serverPromises = servers.map(async serverAddress => {
            const controller = new AbortController()
            const timeoutID = setTimeout(
                () => controller.abort(),
                FETCH_TIMEOUT
            )
            let res
            try {
                res = await fetch(serverAddress + '/profiles', {
                    signal: controller.signal
                })
                clearTimeout(timeoutID)
                // Get the server name from the headers
                const serverName =
                    res.headers.get('X-Server-Name') ?? serverAddress
                // Check if we already have seen this server
                if (seenServers.has(serverName)) return undefined
                // if we haven't seen it, add it to the list of seen servers
                seenServers.add(serverName)

                let profiles = (await res.json()) as Profile[]
                // Check if the returned profiles have an id (ie: the server is out of date)
                // In the case that it does not have one, set it as its index in the profile list
                // Also check the "gameDirectory" key
                profiles = profiles.map((profile, idx) => {
                    if (profile.id === undefined) {
                        profile.id = idx
                    }
                    if (profile.gameDirectory === undefined) {
                        if (profile.gameFolder !== undefined) {
                            profile.gameDirectory = profile.gameFolder
                        }
                    }
                    return profile
                })

                return {
                    name: serverName,
                    data: {
                        address: serverAddress,
                        profiles
                    }
                }
            } catch (err) {
                console.log('unable to fetch profiles from ' + serverAddress)
                return {
                    name: serverAddress,
                    data: { address: serverAddress, profiles: [] as Profile[] }
                }
            }
        })

        const responses = (await Promise.all(serverPromises)).filter(
            r => r !== undefined
        )
        const profiles: Record<string, ServerProfiles> = {}
        responses.forEach(res => (profiles[res.name] = res.data))

        set({ fetching: false, remoteProfiles: profiles })
    }
    fetchRemoteProfiles()
    return {
        remoteProfiles: {},
        localProfiles: ipcRenderer.sendSync('get-local-profiles'),
        fetching: true,
        setLocalProfiles(profiles: ProfileStore['localProfiles']) {
            set({ localProfiles: profiles })
            ipcRenderer.send('set-local-profiles', profiles)
        },
        fetchRemoteProfiles,

        selectedProfile: ipcRenderer.sendSync('get-selected-profile'),
        setSelectedProfile(profile: ProfileStore['selectedProfile']) {
            set({ selectedProfile: profile })
            ipcRenderer.send('set-selected-profile', profile)
        }
    }
})

export const useIsFetching = () => useStore(state => state.fetching)
export const useProfiles = () => {
    const { localProfiles, remoteProfiles } = useStore(state => ({
        localProfiles: state.localProfiles,
        remoteProfiles: state.remoteProfiles
    }))

    const profiles: Record<string, ServerProfiles> = useMemo(
        () => ({
            ...remoteProfiles,
            local: { address: 'local', profiles: localProfiles }
        }),
        [localProfiles, remoteProfiles]
    )

    return profiles
}
export const useLocalProfiles = () =>
    useStore(state => ({
        localProfiles: state.localProfiles,
        setLocalProfiles: state.setLocalProfiles
    }))

export const useSelectedProfile = () => {
    const { selectedProfile, setSelectedProfile, fetching } = useStore(
        state => ({
            selectedProfile: state.selectedProfile,
            setSelectedProfile: state.setSelectedProfile,
            fetching: state.fetching
        })
    )
    const profiles = useProfiles()
    const profileObject = useMemo(() => {
        if (Object.keys(profiles).length === 0 || fetching) return undefined
        if (selectedProfile === undefined) return undefined

        const [serverName, profileID] = selectedProfile
        const serverProfiles = profiles[serverName]
        if (!serverProfiles) {
            setSelectedProfile(undefined)
            return undefined
        }
        const profile = serverProfiles.profiles.find(
            profile => profile.id === profileID
        )
        if (!profile) return undefined
        return {
            serverName,
            address: serverProfiles.address,
            profile
        }
    }, [profiles, selectedProfile])
    return { selectedProfile: profileObject, setSelectedProfile }
}
