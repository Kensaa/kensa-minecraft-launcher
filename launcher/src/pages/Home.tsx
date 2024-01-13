import { ipcRenderer } from 'electron'
import { useEffect, useState } from 'react'
import { Alert, Button } from 'react-bootstrap'
import HomeHeader from '../components/HomeHeader'

import { useIsConnected } from '../stores/auth'
import type { StartArgs } from '../types'

import minecraft from '../img/minecraft.png'
import AlertStack from '../components/AlertStack'
import TaskOverlay from '../components/TaskOverlay'
import { useProfiles, useSelectedProfile } from '../stores/profiles'

export default function Home({
    setOverlay,
    setSettingsShown
}: {
    setOverlay: (overlay: JSX.Element | undefined) => void
    setSettingsShown: (show: boolean) => void
}) {
    const connected = useIsConnected()

    const profiles = useProfiles()
    const { selectedProfile, setSelectedProfile } = useSelectedProfile()
    const [error, setError] = useState('')
    const [info, setInfo] = useState('')

    useEffect(() => {
        if (!(import.meta.env.MODE == 'production')) return
        ipcRenderer.invoke('is-up-to-date').then(res => {
            if (!res) {
                setInfo(
                    'A new update is available, please redownload the launcher at https://github.com/Kensaa/kensa-minecraft-launcher/releases/latest'
                )
            }
        })
    }, [])

    const startGame = () => {
        const profile = profiles[selectedProfile[0]][selectedProfile[1]]
        const args: StartArgs = {
            profile,
            server: selectedProfile[0]
        }

        setOverlay(<TaskOverlay title='Starting Game' />)
        ipcRenderer
            .invoke('start-game', args)
            .then(() => setOverlay(undefined))
            .catch(error => {
                setOverlay(undefined)
                setError(error.message)
            })
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
            />
            <AlertStack>
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
                    disabled={!connected || Object.keys(profiles).length === 0}
                    variant='success'
                    onClick={startGame}
                >
                    Launch Game
                </Button>
            </div>
        </div>
    )
}
