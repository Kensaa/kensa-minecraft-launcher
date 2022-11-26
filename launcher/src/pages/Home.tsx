import { ipcRenderer } from 'electron'
import React, { useEffect, useState } from 'react'
import { Button, ButtonGroup, Dropdown, SplitButton } from 'react-bootstrap'
import ProfileElement from '../components/ProfileElement'
import GameStartingOverlay from '../overlays/GameStartingOverlay'

import authStore from '../stores/auth'
import configStore from '../stores/config'
import { Profile } from '../types'

export default function Home({setOverlay}: {setOverlay: (overlay: JSX.Element | undefined) => void}) {
    const auth = authStore(state => ({...state}))
    const config = configStore(state => ({...state}))
    const [profiles, setProfiles] = useState<Profile[]>([])
    const [selectedProfile, setSelectedProfile] = useState<number>(0)
    useEffect(() => {
        fetch(config.primaryServer+'/profiles')
            .then(res => res.json())
            .then(data => {
                setProfiles(data)
            })
    }, [config])

    const startGame = () => {
        setOverlay(<GameStartingOverlay/>)
        ipcRenderer.invoke('start-game', profiles[selectedProfile]).then(res => setOverlay(undefined))
    }
    return (
        <div className='w-100 h-100 d-flex flex-column align-items-center p-2'>
            <div className='h-75 w-100 d-flex justify-content-center'>
                <div>
                    <h3>Selected Profile : </h3>
                    <ProfileElement profile={profiles[selectedProfile]} />
                </div>
            </div> 
            <div className='w-100 d-flex justify-content-center'>
                <SplitButton
                    drop="up"
                    variant="outline-primary"
                    title="Launch Game"
                    align="end"
                    onClick={() => startGame()}
                >
                    {profiles.map((profile, index) => (
                        <Dropdown.Item onClick={() => setSelectedProfile(index)} key={index}><ProfileElement profile={profile}/></Dropdown.Item>
                    ))}
                </SplitButton>
            </div>
        </div>
    )
}

