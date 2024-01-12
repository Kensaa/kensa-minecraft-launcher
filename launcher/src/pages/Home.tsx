import { ipcRenderer } from 'electron'
import { useEffect, useState } from 'react'
import { Alert, Button } from 'react-bootstrap'
import HomeHeader from '../components/HomeHeader'

import authStore from '../stores/auth'
import configStore from '../stores/config'
import { Profile, StartArgs } from '../types'

import minecraft from '../img/minecraft.png'
import AlertStack from '../components/AlertStack'
import TaskOverlay from '../components/TaskOverlay'

export default function Home({
    setOverlay,
    setSettingsShown
}: {
    setOverlay: (overlay: JSX.Element | undefined) => void
    setSettingsShown: (show: boolean) => void
}) {
    const auth = authStore(state => ({ connected: state.connected }))
    const servers = configStore(state => state.servers)

    const [profiles, setProfiles] = useState<Record<string, Profile[]>>({})
    const [selectedProfile, setSelectedProfile] = useState<[string, number]>([
        '',
        0
    ])
    const [loading, setLoading] = useState<boolean>(false)
    const [error, setError] = useState('')
    const [info, setInfo] = useState('')

    useEffect(() => {
        setLoading(true)

        const p: Record<string, Profile[]> = {}
        Promise.all(
            servers.map(server =>
                fetch(server + '/profiles')
                    .then(res => res.json())
                    .then(data => [server, data])
                    .catch(err => {
                        console.log('unable to fetch profiles from ' + server)
                        return [server, []]
                    })
            )
        ).then(responses => {
            console.log(responses)
            for (const response of responses) {
                if (!response) continue
                const [server, data] = response
                p[server] = data
            }

            setProfiles(p)
            setLoading(false)
        })
    }, [servers])

    useEffect(() => {
        if (Object.keys(profiles).length === 0) return
        const sProfile = ipcRenderer.sendSync('get-selected-profile')
        if (
            !profiles[sProfile[0]] ||
            sProfile[1] >= Object.keys(profiles[sProfile[0]]).length
        ) {
            ipcRenderer.send('set-selected-profile', [0, 0])
            setSelectedProfile([servers[0], 0])
        } else {
            setSelectedProfile(sProfile)
        }
    }, [profiles, servers])

    useEffect(() => {
        if (!(import.meta.env.MODE == 'production')) return
        ipcRenderer.invoke('is-up-to-date').then(res => {
            if (!res) {
                setInfo(
                    'A new update is available, please redownload the launcher at https://github.com/Kensaa/kensa-minecraft-launcher'
                )
            }
        })
    }, [])

    const startGame = () => {
        const profile = profiles[selectedProfile[0]][selectedProfile[1]]

        setOverlay(<TaskOverlay title='Starting Game' />)
        ipcRenderer
            .invoke('start-game', {
                profile,
                server: selectedProfile[0]
            } as StartArgs)
            .then(() => setOverlay(undefined))
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
                        loading ||
                        !auth.connected ||
                        Object.keys(profiles).length === 0
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
