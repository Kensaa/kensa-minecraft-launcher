import { ipcRenderer } from 'electron'
import { Dropdown, Spinner } from 'react-bootstrap'

import { Profile } from '../types'
import ProfileElement from './ProfileElement'
import {
    useIsFetching,
    useProfiles,
    useSelectedProfile
} from '../stores/profiles'
import LoadingSpinner from './LoadingSpinner'
import { useEffect, useState } from 'react'

export default function ProfilePicker() {
    const profiles = useProfiles()
    const fetching = useIsFetching()
    const { selectedProfile, setSelectedProfile } = useSelectedProfile()
    const [profile, setProfile] = useState<Profile | undefined>(undefined)

    useEffect(() => {
        if (fetching) return
        if (Object.keys(profiles).length === 0) return setProfile(undefined)
        //this means that there is no server available, so no profile
        if (selectedProfile[0] === '') return setProfile(undefined)

        const currentServer = profiles[selectedProfile[0]]
        //this could happen, because due to the way that useProfile() is implemented, fetching is set to false before the profiles are set (because it is set in the useEffect of useProfiles(), so it takes one more render to set the profiles)
        if (!currentServer) return setProfile(undefined)

        const profile = currentServer.profiles[selectedProfile[1]]
        // this should never happen (because useSelectedProfile checks for invalid selected profile), but just in case
        if (!profile) return setProfile(undefined)

        setProfile(profile)
    }, [profiles, fetching, selectedProfile])
    const selectProfile = (profile: [string, number]) => {
        setSelectedProfile(profile)
        ipcRenderer.send('set-selected-profile', profile)
    }

    return (
        <div
            style={{ maxWidth: '400px' }}
            className='d-flex flex-column align-items-center'
        >
            <Dropdown className='w-100 h-100'>
                <Dropdown.Toggle
                    disabled={fetching || !profile}
                    style={{ width: '350px' }}
                    className='d-flex flex-column align-items-center'
                    variant={!fetching && !profile ? 'danger' : 'transparent'}
                >
                    {fetching ? (
                        <LoadingSpinner />
                    ) : (
                        <ProfileElement profile={profile} />
                    )}
                </Dropdown.Toggle>
                <Dropdown.Menu className='w-100'>
                    {Object.entries(profiles).map(
                        ([server, { profiles, address }], serverIndex) => {
                            if (!profiles.length) return null
                            return (
                                <div key={serverIndex}>
                                    <Divider
                                        serverName={server}
                                        address={address}
                                    />
                                    {profiles.map((profile, profileIndex) => (
                                        <Dropdown.Item
                                            key={
                                                serverIndex + ',' + profileIndex
                                            }
                                            onClick={() =>
                                                selectProfile([
                                                    server,
                                                    profileIndex
                                                ])
                                            }
                                        >
                                            <ProfileElement profile={profile} />
                                        </Dropdown.Item>
                                    ))}
                                </div>
                            )
                        }
                    )}
                </Dropdown.Menu>
            </Dropdown>
        </div>
    )
}

interface DividerProps {
    serverName: string
    address: string
}

function Divider({ serverName, address }: DividerProps) {
    return (
        <div className='d-flex flex-row align-items-center justify-content-center user-select-none mt-2'>
            <label style={{ color: 'white' }}>
                {serverName === address
                    ? serverName
                    : `${serverName} (${address})`}
            </label>
        </div>
    )
}
