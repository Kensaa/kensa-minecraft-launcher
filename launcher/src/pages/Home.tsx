import { ipcRenderer } from 'electron'
import React, { useEffect, useState } from 'react'
import { Button } from 'react-bootstrap'
import GameStartingOverlay from '../overlays/GameStartingOverlay'

import authStore from '../stores/auth'
import configStore from '../stores/config'
import { Profile } from '../types'
//import { urlJoin, useFetch } from '../utils'

export default function Home({setOverlay}: {setOverlay: (overlay: JSX.Element | undefined) => void}) {
    const auth = authStore(state => ({...state}))
    const config = configStore(state => ({...state}))
    const [profiles, setProfiles] = useState<Profile[]>([])
    //const {data: profiles, loading: profilesLoading, error: profilesError} = useFetch(config.primaryServer+'/profiles',{})
    useEffect(() => {
        fetch(config.primaryServer+'/profiles')
            .then(res => res.json())
            .then(data => {
                setProfiles(data)
            })
    }, [config])

    const startGame = () => {
        //console.log(profiles[0])
        setOverlay(<GameStartingOverlay/>)
        ipcRenderer.invoke('start-game', profiles[0]).then(res => setOverlay(undefined))
    }
    return (
        <div className='w-100 h-100 d-flex flex-column align-items-center p-2'>
            <div className='h-75'>
                MEGA FEUR
            </div>
        <div className='w-100 d-flex justify-content-center border'>
            <Button disabled={!auth.connected} onClick={startGame}>Play</Button>
        </div>
        </div>
    )
}
