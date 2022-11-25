import React from 'react'
import { Button } from 'react-bootstrap'

import authStore from '../stores/auth'
import configStore from '../stores/config'

export default function Home() {
    const auth = authStore(state => ({...state}))
    const config = configStore(state => ({...state}))

    return (
        <div className='w-100 h-100 d-flex flex-column align-items-center p-2'>
            <div className='h-75'>
                MEGA FEUR
            </div>
        <div className='w-100 d-flex justify-content-center border'>
            <Button disabled={!auth.connected}>Play</Button>
        </div>
        </div>
    )
}
