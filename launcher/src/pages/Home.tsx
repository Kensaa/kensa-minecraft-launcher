import { ipcRenderer } from 'electron'
import { useEffect, useState } from 'react'
import { Alert, Button } from 'react-bootstrap'
import GameStartingOverlay from '../overlays/GameStartingOverlay'
import HomeHeader from '../components/HomeHeader'

import authStore from '../stores/auth'
import configStore from '../stores/config'
import { Profile } from '../types'

import minecraft from '../img/minecraft.png'
import AlertStack from '../components/AlertStack'

export default function Home({
    setOverlay,
    setSettingsShown
}: {
    setOverlay: (overlay: JSX.Element | undefined) => void
    setSettingsShown: (show: boolean) => void
}) {
    const auth = authStore(state => ({ ...state }))
    const config = configStore(state => ({ ...state }))
    const [profiles, setProfiles] = useState<Profile[]>([])
    const [selectedProfile, setSelectedProfile] = useState<number>(0)
    const [loading, setLoading] = useState<boolean>(false)
    const [error, setError] = useState('')
    const [info, setInfo] = useState('')

    useEffect(() => {
        setLoading(true)
        fetch(config.primaryServer + '/profiles')
            .then(res => res.json())
            .then(data => {
                setProfiles(data)
                setLoading(false)
            })
            .catch(err => {
                setError(
                    'Unable to fetch profiles, check your internet connection or the server address'
                )
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

    useEffect(() => {
        const javaVersion = ipcRenderer.sendSync('get-java-version')
        if (!javaVersion) {
            setError(
                'Java is not installed, check the path to Java and try again'
            )
        } else {
            const majorVersion = parseInt(javaVersion.split('.')[0])
            if (majorVersion < 17 && majorVersion > 19) {
                setError(
                    "your Java version is too old, please update to Java 17 or newer you also can install Java from the launcher's settings"
                )
            }
        }
    }, [config.jrePath])

    useEffect(() => {
        ipcRenderer.invoke('is-up-to-date').then(res => {
            if (!res) {
                setInfo(
                    'A new update is available, please redownload the launcher at https://github.com/Kensaa/kensa-minecraft-launcher'
                )
            }
        })
    }, [])

    const startGame = () => {
        setOverlay(<GameStartingOverlay />)
        ipcRenderer
            .invoke('start-game', profiles[selectedProfile])
            .then(res => setOverlay(undefined))
            .catch(error => console.log(error))
    }
    return (
        <div
            className='w-100 h-100 d-flex flex-column align-items-center background'
            style={{ backgroundImage: `url(${minecraft})` }}
        >
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
            <AlertStack>
                {config.disableAutoUpdate ? (
                    <Alert
                        style={{
                            textAlign: 'center'
                        }}
                        variant='info'
                        onClose={() => setError('')}
                    >
                        you disabled auto-update, the game WILL NOT be updated
                        while this option is enabled
                    </Alert>
                ) : undefined}
                {error ? (
                    <Alert
                        style={{
                            textAlign: 'center'
                        }}
                        dismissible
                        variant='danger'
                        onClose={() => setError('')}
                    >
                        {error}
                    </Alert>
                ) : undefined}
                {info ? (
                    <Alert
                        style={{
                            textAlign: 'center'
                        }}
                        dismissible
                        variant='warning'
                        onClose={() => setInfo('')}
                    >
                        {info}
                    </Alert>
                ) : undefined}
            </AlertStack>

            <div className='h-25 w-100 d-flex pb-5 justify-content-center align-items-end smooth-background-up position-absolute bottom-0'>
                <Button
                    disabled={
                        loading || !auth.connected || profiles.length === 0
                    }
                    variant='success'
                    onClick={startGame}
                >
                    Launch Game
                </Button>
            </div>
        </div>
    )
}
