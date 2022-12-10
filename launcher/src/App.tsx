import React, { useState } from 'react'
import { ListGroup, Modal } from 'react-bootstrap'

import Home from './pages/Home'
import Settings from './pages/Settings'
import UserElement from './components/UserElement'

import settingsImg from './img/settings.png'

export default function App() {
    const [overlay, setOverlay] = useState<JSX.Element | undefined>(undefined)
    const [settingsShown, setSettingsShown] = useState<boolean>(false)

    return (
        <div className='w-100 h-100 d-flex'>
            {overlay}
            <UserElement setOverlay={setOverlay}/>
            <img width={32} height={32} src={settingsImg} style={{position:'absolute',right:4, top:4, cursor:'pointer'}} onClick={() => setSettingsShown(true)}/>
            <Home setOverlay={setOverlay}/>

            <Modal show={settingsShown} onHide={() => setSettingsShown(false)}>
                <Modal.Header closeButton>
                    <Modal.Title style={{color:'black'}}>Settings</Modal.Title>
                </Modal.Header>
                <Modal.Body><Settings hide={() => setSettingsShown(false)}/></Modal.Body>
            </Modal>
        </div>
    )
}