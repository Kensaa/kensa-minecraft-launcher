import { ipcRenderer } from 'electron'
import { Dropdown, Spinner } from 'react-bootstrap'

import { Profile } from '../types'
import ProfileElement from './ProfileElement'

export interface ProfilePickerProps {
    profiles: Profile[] | undefined
    loading: boolean
    selectedProfile: number
    setSelectedProfile: (index: number) => void
}

export default function ProfilePicker({
    profiles,
    loading,
    selectedProfile,
    setSelectedProfile
}: ProfilePickerProps) {
    const selectProfile = (index: number) => {
        setSelectedProfile(index)
        ipcRenderer.send('set-selected-profile', index)
    }

    return (
        <div
            style={{ maxWidth: '400px' }}
            className='d-flex flex-column align-items-center'
        >
            <Dropdown className='w-100 h-100'>
                <Dropdown.Toggle
                    disabled={!profiles?.length}
                    style={{ width: '350px' }}
                    className='d-flex flex-column align-items-center'
                    variant={!profiles?.length ? 'danger' : 'transparent'}
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
                        <ProfileElement
                            profile={
                                profiles ? profiles[selectedProfile] : undefined
                            }
                        />
                    )}
                </Dropdown.Toggle>
                <Dropdown.Menu className='w-100'>
                    {profiles &&
                        profiles.map((profile, index) => (
                            <Dropdown.Item
                                key={index}
                                onClick={() => selectProfile(index)}
                            >
                                <ProfileElement profile={profile} />
                            </Dropdown.Item>
                        ))}
                </Dropdown.Menu>
            </Dropdown>
        </div>
    )
}
