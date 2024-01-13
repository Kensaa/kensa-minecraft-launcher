import { create } from 'zustand'
import { ipcRenderer } from 'electron'

import { useConfig } from './config'
import { Profile } from '../types'
import { useEffect, useState } from 'react'

interface ServerProfiles {
    address: string
    profiles: Profile[]
}

interface profileStore {
    remoteProfiles: Record<string, ServerProfiles>
    localProfiles: Profile[]
    fetching: boolean
    fetchRemoteProfiles: () => void
    setLocalProfiles: (profiles: Profile[]) => void

    //[server name, profile index]
    selectedProfile: [string, number]
    setSelectedProfile: (profile: [string, number]) => void
}

const useStore = create<profileStore>(set => {
    useConfig.subscribe((config, prev) => {
        if (config.servers !== prev.servers) {
            fetchRemoteProfiles()
        }
    })

    const fetchRemoteProfiles = () => {
        const servers = useConfig.getState().servers
        const profiles: Record<string, ServerProfiles> = {}
        set({ fetching: true })

        const seenServers = new Set<string>()

        Promise.all(
            servers.map(server =>
                fetch(server + '/profiles')
                    .then(res => {
                        //get the server name from the headers
                        const serverName = res.headers.get('X-Server-Name')
                        if (serverName) {
                            // if there is a server name, check if we already have seen it, if so, return nothing
                            if (seenServers.has(serverName)) return undefined
                            // if we haven't seen it, add it to the list of seen servers
                            seenServers.add(serverName)
                        }
                        //then return the profiles
                        // the name is either the server name or the server address
                        return res.json().then(serverProfiles => {
                            return {
                                name: serverName ?? server,
                                data: {
                                    address: server,
                                    profiles: serverProfiles as Profile[]
                                }
                            }
                        })
                    })
                    .catch(err => {
                        console.log(err)
                        console.log('unable to fetch profiles from ' + server)
                        return {
                            name: server,
                            data: { address: server, profiles: [] as Profile[] }
                        }
                    })
            )
        ).then(responses => {
            console.log('resp', responses)
            for (const response of responses) {
                if (!response) continue

                const { name, data } = response
                profiles[name] = data
            }
            set({ remoteProfiles: profiles, fetching: false })
        })
    }

    fetchRemoteProfiles()

    return {
        remoteProfiles: {},
        localProfiles: ipcRenderer.sendSync('get-local-profiles'),
        fetchRemoteProfiles,
        fetching: true,
        setLocalProfiles: (profiles: Profile[]) => {
            set({ localProfiles: profiles })
            ipcRenderer.send('set-local-profiles', profiles)
        },

        selectedProfile: ipcRenderer.sendSync('get-selected-profile'),
        setSelectedProfile: (profile: [string, number]) => {
            set({ selectedProfile: profile })
            ipcRenderer.send('set-selected-profile', profile)
        }
    }
})
export default useStore

export const useProfiles = () => {
    const { localProfiles, remoteProfiles } = useStore(state => ({
        localProfiles: state.localProfiles,
        remoteProfiles: state.remoteProfiles
    }))

    const [profiles, setProfiles] = useState<Record<string, ServerProfiles>>({})

    useEffect(() => {
        setProfiles({
            ...remoteProfiles,
            local: { address: 'local', profiles: localProfiles }
        })
    }, [localProfiles, remoteProfiles])

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
    const servers = useConfig(state => state.servers)

    useEffect(() => {
        if (Object.keys(profiles).length === 0 || fetching) return

        if (
            !profiles[selectedProfile[0]] ||
            selectedProfile[1] >= profiles[selectedProfile[0]].profiles.length
        ) {
            const firstServer = Object.entries(profiles)[0]
            const newSelectedProfile = [firstServer[0], 0] as [string, number]
            ipcRenderer.send('set-selected-profile', newSelectedProfile)
            setSelectedProfile(newSelectedProfile)
        }
    }, [profiles, servers])

    return { selectedProfile, setSelectedProfile }
}

export const useIsFetching = () => useStore(state => state.fetching)
