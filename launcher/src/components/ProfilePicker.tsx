import { ipcRenderer } from 'electron'
import { Dropdown, OverlayTrigger, Spinner, Tooltip } from 'react-bootstrap'

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
import { useConfig } from '../stores/config'

export default function ProfilePicker() {
    const profiles = useProfiles()
    const fetching = useIsFetching()
    const { setSelectedProfile } = useSelectedProfile()
    const showHiddenProfiles = useConfig(config => config.showHiddenProfiles)

    const filteredProfiles = useMemo(() => {
        if (showHiddenProfiles) return profiles
        const out: typeof profiles = {}
        for (const [server, serverProfiles] of Object.entries(profiles)) {
            const filtered = serverProfiles.profiles.filter(p => !p.hidden)
            if (filtered.length === 0) continue
            out[server] = {
                address: serverProfiles.address,
                profiles: filtered
            }
        }
        return out
    }, [profiles, showHiddenProfiles])

    return (
        <div
            style={{ maxWidth: '400px' }}
            className='d-flex flex-column align-items-center'
        >
            <Dropdown className='w-100 h-100'>
                <DropdownToggle
                    profiles={filteredProfiles}
                    fetching={fetching}
                />
                <Dropdown.Menu className='w-100'>
                    {Object.entries(filteredProfiles).map(
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
                                            key={`${serverIndex}-${profileIndex}`}
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
interface DropdownToggleProps {
    profiles: ReturnType<typeof useProfiles>
    fetching: boolean
}
function DropdownToggle({ profiles, fetching }: DropdownToggleProps) {
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
                <>
                    <h2 className='mb-0'>No profile</h2>
                    <h6>
                        create local profiles or <br></br>
                        add a server in the Settings
                    </h6>
                </>
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
