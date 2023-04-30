import authStore from '../stores/auth'
import { Button, Dropdown, DropdownButton } from 'react-bootstrap'
import { User, UserPlus } from 'lucide-react'

import ConnectingOverlay from '../overlays/ConnectingOverlay'

export default function UserElement({
    setOverlay
}: {
    setOverlay: (setOverlay: JSX.Element | undefined) => void
}) {
    const auth = authStore(state => ({ ...state }))
    const login = () => {
        setOverlay(<ConnectingOverlay />)
        auth.connect().then(() => setOverlay(undefined))
    }

    return auth.connected ? (
        <DropdownButton
            title={
                <>
                    <User size={16} className='me-1' />
                    {auth.profile.name}
                </>
            }
        >
            <Dropdown.Item
                onClick={auth.logout}
                className='d-flex align-items-center'
            >
                Logout
            </Dropdown.Item>
        </DropdownButton>
    ) : (
        <Button variant='light' onClick={login}>
            <UserPlus size={16} className='me-1' />
            Login
        </Button>
    )
}
