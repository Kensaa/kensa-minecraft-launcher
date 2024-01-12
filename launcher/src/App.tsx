import { useState } from 'react'
import { Modal } from 'react-bootstrap'

import Home from './pages/Home'
import Settings from './pages/Settings'
import ServerManager from './pages/ServerManager'

export default function App() {
    const [overlay, setOverlay] = useState<JSX.Element | undefined>(undefined)
    const [settingsShown, setSettingsShown] = useState<boolean>(false)
    const [serverManagerShown, setServerManagerShown] = useState<boolean>(true)

    return (
        <div className='w-100 h-100 d-flex'>
            {overlay}
            <Home setOverlay={setOverlay} setSettingsShown={setSettingsShown} />

            <Modal show={settingsShown} onHide={() => setSettingsShown(false)}>
                <Modal.Header closeButton>
                    <Modal.Title style={{ color: 'black' }}>
                        Settings
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Settings
                        hide={() => setSettingsShown(false)}
                        showServerManager={() => setServerManagerShown(true)}
                    />
                </Modal.Body>
            </Modal>

            <Modal
                show={serverManagerShown}
                onHide={() => setServerManagerShown(false)}
            >
                <Modal.Header closeButton>
                    <Modal.Title style={{ color: 'black' }}>
                        Server Manager
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <ServerManager />
                </Modal.Body>
            </Modal>
        </div>
    )
}
