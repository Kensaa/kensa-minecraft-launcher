import { useState } from 'react'
import {
    Button,
    AppBar,
    Toolbar,
    Typography,
    MenuItem,
    IconButton,
    Box
} from '@mui/material'
import AccountCircle from '@mui/icons-material/AccountCircle'
import { Link, useLocation } from 'wouter'
import { useAuth } from '../stores/auth'
import DropdownMenu from './DropdownMenu'

type Page = {
    name: string
    path: string
}

const pages: Page[] = []

export default function Navbar() {
    const [, setLocation] = useLocation()
    const [anchor, setAnchor] = useState<null | HTMLElement>(null)
    const connected = useAuth(state => state.connected)
    const userInfos = useAuth(state => state.userInfos)
    const logout = useAuth(state => state.logout)

    return (
        <Box sx={{ flexGrow: 1 }}>
            <AppBar component='nav' position='static'>
                <Toolbar>
                    <Box
                        sx={{
                            flexGrow: 1,

                            display: {
                                xs: 'none',
                                sm: 'flex'
                            },
                            alignItems: 'center'
                        }}
                    >
                        <Typography
                            variant='h5'
                            component={Link}
                            to='/'
                            sx={{ textDecoration: 'none', color: 'inherit' }}
                        >
                            Kensa Minecraft Launcher
                        </Typography>
                        <Box
                            component='div'
                            display='flex'
                            sx={{ flexGrow: 1, marginLeft: '3rem' }}
                        >
                            {pages.map(page => (
                                <Button
                                    key={page.name}
                                    color='inherit'
                                    component={Link}
                                    to={page.path}
                                >
                                    {page.name}
                                </Button>
                            ))}
                        </Box>
                        {connected ? (
                            <UserIcon
                                onClick={e => setAnchor(e.currentTarget)}
                            />
                        ) : (
                            <Button
                                color='inherit'
                                component={Link}
                                to='/login'
                            >
                                Login
                            </Button>
                        )}
                    </Box>
                </Toolbar>
                <DropdownMenu anchor={anchor} hide={() => setAnchor(null)}>
                    <MenuItem component={Link} to='/account'>
                        My Account
                    </MenuItem>
                    {userInfos && userInfos.is_admin ? (
                        <MenuItem
                            onClick={() => setLocation('/admin/createAccount')}
                        >
                            Create Account
                        </MenuItem>
                    ) : undefined}
                    <MenuItem onClick={logout}>Logout</MenuItem>
                </DropdownMenu>
            </AppBar>
        </Box>
    )
}

interface UserIconProps {
    onClick: (event: React.MouseEvent<HTMLElement>) => void
}

function UserIcon({ onClick }: UserIconProps) {
    const connected = useAuth(state => state.connected)
    const userInfos = useAuth(state => state.userInfos)
    if (!connected || !userInfos) return <div></div>

    return (
        <>
            <Typography>
                Logged in as <b>{userInfos.username}</b>
            </Typography>
            <IconButton onClick={onClick}>
                <AccountCircle />
            </IconButton>
        </>
    )
}
