import { Menu } from '@mui/material'

interface DropdownMenuProps {
    anchor: HTMLElement | null
    hide: () => void
    children: React.ReactNode
}

export default function DropdownMenu({
    anchor,
    hide,
    children
}: DropdownMenuProps) {
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
