import { Box, Button, Typography } from '@mui/material'
import type { ModalProps } from './Modal'
import Modal from './Modal'
import { useState } from 'react'
import { ValidatedTextField } from './ValidatedTextField'
import { address } from '../config'
import { useSnackbar } from 'notistack'

type CreateGameDirectoryModal = Omit<ModalProps, 'children'> & {
    onResult: (gameDirectory: string) => void
}

export default function CreateGameDirectoryModal({
    onResult,
    ...props
}: CreateGameDirectoryModal) {
    const { enqueueSnackbar } = useSnackbar()
    const [name, setName] = useState('')

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        if (!e.currentTarget.checkValidity()) return

        const body = {
            name
        }

        fetch(`${address}/web-api/gameDirectory`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        }).then(res => {
            if (res.ok) {
                onResult(name)
                props.onClose()
            } else {
                res.text().then(text =>
                    enqueueSnackbar(text, { variant: 'error' })
                )
            }
        })
    }

    return (
        <Modal {...props}>
            <Typography variant='h4' textAlign='center' color='text.primary'>
                Create a new game directory
            </Typography>
            <Box
                component='form'
                onSubmit={handleSubmit}
                noValidate
                sx={{ mt: 1, width: { xs: '100%', sm: '75%' } }}
            >
                <ValidatedTextField
                    margin='normal'
                    autoFocus
                    required
                    fullWidth
                    label='Name'
                    value={name}
                    onChange={e => setName(e.target.value)}
                    errorMessage='A name is required'
                />

                <Button
                    type='submit'
                    fullWidth
                    variant='contained'
                    sx={{ mt: 3, mb: 2 }}
                    disabled={name === ''}
                >
                    Create
                </Button>
            </Box>
        </Modal>
    )
}
