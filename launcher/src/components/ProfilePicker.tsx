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

export default function ProfilePicker() {
    const profiles = useProfiles()
    const fetching = useIsFetching()
    const { selectedProfile, setSelectedProfile } = useSelectedProfile()

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
                    disabled={!currentServer.length || fetching}
                    style={{ width: '350px' }}
                    className='d-flex flex-column align-items-center'
                    variant={
                        !currentServer.length && !fetching
                            ? 'danger'
                            : 'transparent'
                    }
                >
                    {fetching ? (
                        <LoadingSpinner />
                    ) : (
                        <ProfileElement profile={profile} />
                    )}
                </Dropdown.Toggle>
                <Dropdown.Menu className='w-100'>
                    {Object.entries(profiles).map(
                        ([server, profiles], serverIndex) => {
                            if (!profiles.length) return null
                            return (
                                <div key={serverIndex}>
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
                                </div>
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
        <div className='d-flex flex-row align-items-center justify-content-center user-select-none mt-3'>
            <label style={{ color: 'white' }}>{text}</label>
        </div>
    )
}
