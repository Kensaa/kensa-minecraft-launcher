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
import { useEffect, useMemo, useState } from 'react'
import { ServerCrash } from 'lucide-react'

export default function ProfilePicker() {
    const profiles = useProfiles()
    const fetching = useIsFetching()
    const { setSelectedProfile } = useSelectedProfile()

    console.log(profiles)
    return (
        <div
            style={{ maxWidth: '400px' }}
            className='d-flex flex-column align-items-center'
        >
            <Dropdown className='w-100 h-100'>
                <DropdownToggle />
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
                                            key={`${serverIndex},${profile.id ?? profileIndex}`}
                                            onClick={() =>
                                                setSelectedProfile([
                                                    server,
                                                    profile.id
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

function DropdownToggle() {
    const profiles = useProfiles()
    const fetching = useIsFetching()
    const { selectedProfile } = useSelectedProfile()

    // There is at least one profile
    const someProfilesExist = useMemo(
        () =>
            Object.values(profiles).some(
                profile => profile.profiles.length > 0
            ),
        [profiles]
    )

    return (
        <Dropdown.Toggle
            disabled={fetching || !someProfilesExist}
            style={{ width: '350px' }}
            className='d-flex flex-column align-items-center'
            variant={!fetching && !someProfilesExist ? 'danger' : 'transparent'}
        >
            {fetching ? (
                <LoadingSpinner />
            ) : !someProfilesExist ? (
                <h2 className='mb-0'>No profile</h2>
            ) : !selectedProfile ? (
                <h2>Select a profile</h2>
            ) : (
                <ProfileElement profile={selectedProfile.profile} />
            )}
        </Dropdown.Toggle>
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
