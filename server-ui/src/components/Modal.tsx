import React from 'react'
import MUIModal from '@mui/material/Modal'
import { Box } from '@mui/material'

export type ModalProps = React.PropsWithChildren<{
    open: boolean
    onClose: () => void
}>

const style = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    minWidth: { xs: '90%', sm: '50%' },
    minHeight: { xs: '90%', sm: '70%' },
    maxWidth: '90%',
    maxHeight: '90%',
    overflow: 'auto',
    bgcolor: 'background.paper',
    boxShadow: 24,
    p: 4,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center'
}

export default function Modal({ children, ...props }: ModalProps) {
    return (
        <MUIModal {...props}>
            <Box sx={style}>{children}</Box>
        </MUIModal>
    )
}
