import { useState } from 'react'
import {
    Button,
    AppBar,
    Toolbar,
    Typography,
    Menu,
    MenuItem,
    IconButton,
    Box,
    Drawer,
    Divider,
    List,
    ListItem,
    ListItemButton,
    ListItemText
} from '@mui/material'
import AccountCircle from '@mui/icons-material/AccountCircle'
import MenuIcon from '@mui/icons-material/Menu'
import { Link } from 'wouter'
import { useAuth } from '../stores/auth'

type Page = {
    name: string
    path: string
}

const pages: Page[] = []

export default function Navbar() {
    const [anchor, setAnchor] = useState<null | HTMLElement>(null)
    // const isConnected = useIsConnected()
    const connected = useAuth(state => state.connected)
    const logout = useAuth(state => state.logout)
    // const { connected, logout } = useAuth(state => ({
    //     logout: state.logout,
    //     connected: state.connected
    // }))
    const [drawerOpened, setDrawerOpened] = useState(false)

    const toggleDrawer = () => setDrawerOpened(!drawerOpened)
    return (
        <Box sx={{ flexGrow: 1 }}>
            <AppBar component='nav' position='static'>
                <Toolbar>
                    <IconButton
                        color='inherit'
                        aria-label='open drawer'
                        edge='start'
                        onClick={toggleDrawer}
                        sx={{ mr: 2, display: { sm: 'none' } }}
                    >
                        <MenuIcon />
                    </IconButton>
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
                <nav>
                    <Drawer
                        variant='temporary'
                        open={drawerOpened}
                        onClose={() => setDrawerOpened(false)}
                        ModalProps={{
                            keepMounted: true
                        }}
                        sx={{
                            display: { xs: 'block', sm: 'none' },
                            '& .MuiDrawer-paper': {
                                boxSizing: 'border-box',
                                width: '240px'
                            }
                        }}
                    >
                        <Box
                            onClick={toggleDrawer}
                            sx={{ textAlign: 'center' }}
                        >
                            <Typography
                                variant='h6'
                                component={Link}
                                to='/'
                                sx={{
                                    my: 2,
                                    textDecoration: 'none',
                                    color: 'inherit'
                                }}
                            >
                                The Bulk Project
                            </Typography>
                            <Divider />
                            <List>
                                {pages.map(item => (
                                    <ListItem key={item.name} disablePadding>
                                        <ListItemButton
                                            sx={{ textAlign: 'center' }}
                                            LinkComponent={Link}
                                            href={item.path}
                                        >
                                            <ListItemText primary={item.name} />
                                        </ListItemButton>
                                    </ListItem>
                                ))}
                            </List>
                        </Box>
                    </Drawer>
                </nav>

                <NavbarMenu anchor={anchor} hide={() => setAnchor(null)}>
                    <MenuItem component={Link} to='/account'>
                        My Account
                    </MenuItem>
                    <MenuItem onClick={logout}>Logout</MenuItem>
                </NavbarMenu>
            </AppBar>
        </Box>
    )
}

interface UserIconProps {
    onClick: (event: React.MouseEvent<HTMLElement>) => void
}

function UserIcon({ onClick }: UserIconProps) {
    const connected = useAuth(state => state.connected)
    if (!connected) return <div></div>

    return (
        <>
            <IconButton onClick={onClick}>
                <AccountCircle />
            </IconButton>
        </>
    )
}

interface NavbarMenuProps {
    anchor: HTMLElement | null
    hide: () => void
    children: React.ReactNode
}

function NavbarMenu({ anchor, hide, children }: NavbarMenuProps) {
    return (
        <>
            <Menu
                anchorEl={anchor}
                id='account-menu'
                open={!!anchor}
                onClose={hide}
                onClick={hide}
                slotProps={{
                    paper: {
                        elevation: 0,
                        sx: {
                            overflow: 'visible',
                            filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
                            mt: 1.5,
                            '& .MuiAvatar-root': {
                                width: 32,
                                height: 32,
                                ml: -0.5,
                                mr: 1
                            },
                            '&:before': {
                                content: '""',
                                display: 'block',
                                position: 'absolute',
                                top: 0,
                                right: 15,
                                width: 10,
                                height: 10,
                                bgcolor: 'background.paper',
                                transform: 'translateY(-50%) rotate(45deg)',
                                zIndex: 0
                            }
                        }
                    }
                }}
                transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            >
                {children}
            </Menu>
        </>
    )
}
