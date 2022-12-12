import { ipcRenderer } from 'electron'
import { useEffect, useState } from 'react'
import { Alert, Button } from 'react-bootstrap'
import GameStartingOverlay from '../overlays/GameStartingOverlay'
import HomeHeader from '../components/HomeHeader'

import authStore from '../stores/auth'
import configStore from '../stores/config'
import { Profile } from '../types'

import minecraft from '../img/minecraft.png'

export default function Home({
    setOverlay,
    setSettingsShown
}: {
    setOverlay: (overlay: JSX.Element | undefined) => void,
    setSettingsShown: (show: boolean) => void
}) {
    const auth = authStore(state => ({ ...state }))
    const config = configStore(state => ({ ...state }))
    const [profiles, setProfiles] = useState<Profile[]>([])
    const [selectedProfile, setSelectedProfile] = useState<number>(0)
    const [loading, setLoading] = useState<boolean>(false)
    const [error, setError] = useState('')

    useEffect(() => {
        setLoading(true)
        fetch(config.primaryServer + '/profiles')
            .then(res => res.json())
            .then(data => {
                setProfiles(data)
                setLoading(false)
            }).catch(err => {
                setError('Unable to fetch profiles, check your internet connection or the server address')
                setLoading(false)
            })
    }, [config.primaryServer])

    useEffect(() => {
        if (profiles.length === 0) return
        const sProfile = ipcRenderer.sendSync('get-selected-profile')
        if (sProfile >= profiles.length) {
            ipcRenderer.send('set-selected-profile', 0)
            setSelectedProfile(0)
        } else {
            setSelectedProfile(sProfile)
        }
    }, [profiles])

    const startGame = () => {
        setOverlay(<GameStartingOverlay />)
        ipcRenderer.invoke('start-game', profiles[selectedProfile]).then(res => setOverlay(undefined)).catch(error => console.log(error))
    }
    return (
        <div className='w-100 h-100 d-flex flex-column align-items-center background' style={{ backgroundImage: `url(${minecraft})` }}>
            {error && (
                <Alert
                    className="m-5 position-absolute"
                    style={{ zIndex: 9000 }}
                    dismissible
                    variant="danger"
                    onClose={() => setError('')}
                >
                    {error}
                </Alert>
            )}
            <HomeHeader
                {...{
                    setOverlay,
                    setSettingsShown
                }}
                profileProps={{
                    profiles,
                    loading,
                    selectedProfile,
                    setSelectedProfile
                }}
            />
            <div className='h-25 w-100 d-flex pb-5 justify-content-center align-items-end smooth-background-up position-absolute bottom-0'>
                <Button
                    disabled={loading || !auth.connected || profiles.length === 0}
                    variant="success"
                    onClick={startGame}
                >Launch Game</Button>
            </div>
        </div>
    )
}

