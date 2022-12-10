import { ipcRenderer } from 'electron'
import React, { useState } from 'react'
import { Dropdown } from 'react-bootstrap'
import { Profile } from '../types'
import ProfileElement from './ProfileElement'


interface ProfilePickerProps {
    profiles: Profile[] | undefined
    loading: boolean,
    selectedProfile: number
    setSelectedProfile: (index: number) => void
}

export default function ProfilePicker({profiles, loading, selectedProfile, setSelectedProfile}: ProfilePickerProps) {


    const selectProfile = (index: number) => {
        setSelectedProfile(index)
        ipcRenderer.send('set-selected-profile', index)
    }

  return (
    <div style={{maxWidth:'400px'}} className='d-flex flex-column align-items-center'>
            <Dropdown className="w-100 h-100">
                <Dropdown.Toggle style={{borderRadius: "0px", width:'350px'}} className="d-flex flex-column align-items-center btn-transparent">
                    <ProfileElement profile={profiles ? profiles[selectedProfile] : undefined} loading={loading}/>
                </Dropdown.Toggle>
                <Dropdown.Menu className="w-100">
                    {profiles && profiles.map((profile, index) => (
                        <Dropdown.Item key={index} onClick={() => selectProfile(index)}>
                            <ProfileElement profile={profile} loading={loading}/>
                        </Dropdown.Item>
                    ))}
                </Dropdown.Menu>
            </Dropdown>
        </div>
  )
}
