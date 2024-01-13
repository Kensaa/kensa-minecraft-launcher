import { create } from 'zustand'
import { ipcRenderer } from 'electron'

import { useConfig } from './config'
import { Profile } from '../types'
import { useEffect, useState } from 'react'

interface profileStore {
    remoteProfiles: Record<string, Profile[]>
    localProfiles: Profile[]
    fetching: boolean
    fetchRemoteProfiles: () => void
    setLocalProfiles: (profiles: Profile[]) => void

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
        const profiles: Record<string, Profile[]> = {}
        set({ fetching: true })
        Promise.all(
            servers.map(server =>
                fetch(server + '/profiles')
                    .then(res => res.json())
                    .then(data => [server, data])
                    .catch(err => {
                        console.log('unable to fetch profiles from ' + server)
                        return [server, []]
                    })
            )
        ).then(responses => {
            for (const response of responses) {
                if (!response) continue
                const [server, data] = response
                profiles[server] = data
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

    const [profiles, setProfiles] = useState<Record<string, Profile[]>>({})

    useEffect(() => {
        setProfiles({ ...remoteProfiles, local: localProfiles })
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
            selectedProfile[1] >=
                Object.keys(profiles[selectedProfile[0]]).length
        ) {
            ipcRenderer.send('set-selected-profile', [0, 0])
            setSelectedProfile([servers[0], 0])
        }
    }, [profiles, servers])

    return { selectedProfile, setSelectedProfile }
}

export const useIsFetching = () => useStore(state => state.fetching)
