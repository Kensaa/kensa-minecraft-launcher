import { useAuth } from '../stores/auth'
import { Button, Dropdown, DropdownButton } from 'react-bootstrap'
import { User, UserPlus } from 'lucide-react'

export default function UserElement() {
    const auth = useAuth()
    const login = () => {
        auth.connect()
    }

    console.log(auth)
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
