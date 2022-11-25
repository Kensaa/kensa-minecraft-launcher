import React from 'react'
import authStore from '../stores/auth'
import { Button, Dropdown } from 'react-bootstrap'

import ConnectingOverlay from '../overlays/ConnectingOverlay'



export default function UserElement({setOverlay}: {setOverlay: (setOverlay: JSX.Element | undefined) => void}) {
    const auth = authStore(state => ({...state}))

    const login = () => {
        setOverlay(<ConnectingOverlay/>)
        auth.connect().then(() => setOverlay(undefined)) 
    }

    return(
        <div className='w-100 d-flex justify-content-center'>
            {auth.connected 
            ?
            <Dropdown className="w-100">
                <Dropdown.Toggle  style={{borderRadius: "0px"}} className="w-100" variant='secondary'>{auth.profile.name}</Dropdown.Toggle>
                <Dropdown.Menu className="w-100">
                    <Dropdown.Item onClick={auth.logout}>Logout</Dropdown.Item>
                </Dropdown.Menu>
            </Dropdown>
            :
            <>
                <Button style={{borderRadius:"0px"}} variant='secondary' className='w-100' onClick={login}>Login</Button>
            </>
            }
        </div>
    )
}