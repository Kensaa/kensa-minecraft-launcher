import { ipcRenderer } from 'electron'
import { Dropdown, Spinner } from 'react-bootstrap'

import { Profile } from '../types'
import ProfileElement from './ProfileElement'

export interface ProfilePickerProps {
    profiles: Record<string, Profile[]>
    loading: boolean
    selectedProfile: [string, number]
    setSelectedProfile: (profile: [string, number]) => void
}

export default function ProfilePicker({
    profiles,
    loading,
    selectedProfile,
    setSelectedProfile
}: ProfilePickerProps) {
    const selectProfile = (profile: [string, number]) => {
        setSelectedProfile(profile)
        ipcRenderer.send('set-selected-profile', profile)
    }

    const currentServer = profiles[selectedProfile[0]] ?? []
    const profile = currentServer[selectedProfile[1]] ?? undefined

    return (
        <div
            style={{ maxWidth: '400px' }}
            className='d-flex flex-column align-items-center'
        >
            <Dropdown className='w-100 h-100'>
                <Dropdown.Toggle
                    disabled={!currentServer.length}
                    style={{ width: '350px' }}
                    className='d-flex flex-column align-items-center'
                    variant={!currentServer.length ? 'danger' : 'transparent'}
                >
                    {loading ? (
                        <div>
                            <Spinner animation='border' role='status'>
                                <span className='visually-hidden'>
                                    Loading...
                                </span>
                            </Spinner>
                        </div>
                    ) : (
                        <ProfileElement profile={profile} />
                    )}
                </Dropdown.Toggle>
                <Dropdown.Menu className='w-100'>
                    {Object.entries(profiles).map(
                        ([server, profiles], serverIndex) => {
                            if (!profiles.length) return null
                            return (
                                <>
                                    <Divider text={server} />
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
                                </>
                            )
                        }
                    )}
                </Dropdown.Menu>
            </Dropdown>
        </div>
    )
}

function Divider({ text }: { text: string }) {
    return (
        <div className='d-flex flex-row align-items-center justify-content-center user-select-none'>
            <label style={{ color: 'white' }}>{text}</label>
        </div>
    )
}
