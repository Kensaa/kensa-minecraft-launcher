import { ipcRenderer } from 'electron'
import React, { useEffect, useState } from 'react'
import { Alert, Button } from 'react-bootstrap'
import GameStartingOverlay from '../overlays/GameStartingOverlay'
import ProfilePicker from '../components/ProfilePicker'

import authStore from '../stores/auth'
import configStore from '../stores/config'
import { Profile } from '../types'

import minecraft from '../img/minecraft.png'

export default function Home({setOverlay}: {setOverlay: (overlay: JSX.Element | undefined) => void}) {
    const auth = authStore(state => ({...state}))
    const config = configStore(state => ({...state}))
    const [profiles, setProfiles] = useState<Profile[]>([])
    const [selectedProfile, setSelectedProfile] = useState<number>(0)
    const [loading, setLoading] = useState<boolean>(false)
    const [error, setError] = useState('')

    useEffect(() => {
        setLoading(true)
        fetch(config.primaryServer+'/profiles')
            .then(res => res.json())
            .then(data => {
                setProfiles(data)
                setLoading(false)
            }).catch(err => {
                setError('unable to fetch profiles, check your internet connection or that the server address is correct')
                setLoading(false)
            })
    }, [ config.primaryServer ])

    useEffect(() => {
        if(profiles.length === 0) return
        const sProfile = ipcRenderer.sendSync('get-selected-profile')
        if(sProfile >= profiles.length){
            ipcRenderer.send('set-selected-profile', 0)
            setSelectedProfile(0)
        }else{
            setSelectedProfile(sProfile)
        }
    }, [ profiles ])

    const startGame = () => {
        setOverlay(<GameStartingOverlay/>)
        ipcRenderer.invoke('start-game', profiles[selectedProfile]).then(res => setOverlay(undefined)).catch(error => console.log(error))
    }
    return (
        <div className='w-100 h-100 d-flex flex-column align-items-center background' style={{ backgroundImage: `url(${minecraft})`}}>
            {error && <Alert style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 999 }} dismissible variant="danger" onClose={() => setError('')}>{error}</Alert>}
            <div className="h-100 w-100">
                <div className='h-25 w-100 d-flex justify-content-center smooth-background-down'>
                    <ProfilePicker profiles={profiles} loading={loading} selectedProfile={selectedProfile} setSelectedProfile={setSelectedProfile}/>
                    
                </div> 
            </div>
            <div className='h-25 w-100 d-flex justify-content-center align-items-center smooth-background-up'>
                <Button
                    disabled={loading || !auth.connected || profiles.length === 0}
                    variant="success"
                    onClick={startGame}
                >Launch Game</Button>
            </div>
        </div>
    )
}

