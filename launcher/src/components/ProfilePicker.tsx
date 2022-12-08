import React, { useState } from 'react'
import { Dropdown } from 'react-bootstrap'
import { Profile } from '../types'
import ProfileElement from './ProfileElement'


interface ProfilePickerProps {
    profiles: Profile[] | undefined
    loading: boolean
}

export default function ProfilePicker({profiles, loading}: ProfilePickerProps) {

    const [selectedProfile, setSelectedProfile] = useState<number>(0)

  return (
    <div style={{maxWidth:'400px'}} className='d-flex flex-column align-items-center'>
            <Dropdown className="w-100 h-100">
                <Dropdown.Toggle  style={{borderRadius: "0px"}} className="w-100">
                    <ProfileElement profile={profiles ? profiles[selectedProfile] : undefined} loading={loading}/>
                </Dropdown.Toggle>
                <Dropdown.Menu className="w-100">
                    <Dropdown.Item >Logout</Dropdown.Item>
                </Dropdown.Menu>
            </Dropdown>
        </div>
  )
}
