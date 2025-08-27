import { useState } from 'react'
import { Modal } from 'react-bootstrap'

import Home from './pages/Home'
import Settings from './pages/Settings'
import ServerManager from './pages/ServerManager'
import ProfileManager from './pages/ProfileManager'

export default function Launcher() {
    const [settingsShown, setSettingsShown] = useState<boolean>(false)
    const [serverManagerShown, setServerManagerShown] = useState<boolean>(false)
    const [profileManagerShown, setProfileManagerShown] =
        useState<boolean>(false)

    return (
        <div className='w-100 h-100 d-flex'>
            <Home setSettingsShown={setSettingsShown} />

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
                        showProfileManager={() => setProfileManagerShown(true)}
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

            <Modal
                show={profileManagerShown}
                onHide={() => setProfileManagerShown(false)}
            >
                <Modal.Header closeButton>
                    <Modal.Title style={{ color: 'black' }}>
                        Local Profile Manager
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <ProfileManager />
                </Modal.Body>
            </Modal>
        </div>
    )
}
