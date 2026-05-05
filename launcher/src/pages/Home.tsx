import { ipcRenderer, shell } from 'electron'
import { useEffect, useState } from 'react'
import { Alert, Button, ProgressBar } from 'react-bootstrap'
import HomeHeader from '../components/HomeHeader'

import { useIsConnected } from '../stores/auth'
import type { IPCHandlerResult, StartArgs } from '../types'

import minecraft from '../img/minecraft.png'
import AlertStack from '../components/AlertStack'
import {
    useIsFetching,
    useProfiles,
    useSelectedProfile
} from '../stores/profiles'
import TaskProgressBar from '../components/TaskProgressBar'

export default function Home({
    setSettingsShown
}: {
    setSettingsShown: (show: boolean) => void
}) {
    const connected = useIsConnected()

    const profiles = useProfiles()
    const fetching = useIsFetching()

    const { selectedProfile } = useSelectedProfile()
    const [error, setError] = useState('')
    const [info, setInfo] = useState<JSX.Element | undefined>(undefined)

    useEffect(() => {
        if (!(import.meta.env.MODE == 'production')) return
        ipcRenderer.invoke('get-update-status').then(res => {
            const { autoUpdate, manualUpdate } = res
            if (autoUpdate) {
                setInfo(
                    <>
                        <>
                            An update is available, install it by clicking{' '}
                            <a
                                onClick={e => {
                                    e.preventDefault()
                                    ipcRenderer.invoke('start-update')
                                    setInfo(undefined)
                                }}
                                href=''
                            >
                                here
                            </a>
                        </>
                    </>
                )
            } else if (manualUpdate) {
                // manual update
                setInfo(
                    <>
                        A new version is available, please redownload the
                        launcher{' '}
                        <a
                            onClick={e => {
                                e.preventDefault()
                                shell.openExternal(
                                    'https://github.com/Kensaa/kensa-minecraft-launcher/releases/latest'
                                )
                            }}
                            href=''
                        >
                            here
                        </a>
                    </>
                )
            }
        })
    }, [])

    const startGame = () => {
        if (!selectedProfile) return
        const args: StartArgs = {
            profile: selectedProfile.profile,
            server: selectedProfile.address
        }

        ipcRenderer
            .invoke('start-game', args)
            .then((result: IPCHandlerResult) => {
                if (!result.success) {
                    setError(result.error)
                }
            })
    }

    return (
        <div
            className='w-100 h-100 d-flex flex-column align-items-center background'
            style={{ backgroundImage: `url(${minecraft})` }}
        >
            <HomeHeader
                {...{
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
                        onClose={() => setInfo(undefined)}
                    >
                        {info}
                    </Alert>
                ) : undefined}
            </AlertStack>

            <div className='h-25 w-100 d-flex pb-5 justify-content-center align-items-end smooth-background-up position-absolute bottom-0'>
                <Button
                    disabled={
                        !connected ||
                        Object.keys(profiles).length === 0 ||
                        fetching
                    }
                    variant='success'
                    onClick={startGame}
                >
                    Launch Game
                </Button>
            </div>
            <TaskProgressBar />
        </div>
    )
}
