import {
    Box,
    Button,
    FormControlLabel,
    Switch,
    Typography
} from '@mui/material'
import Navbar from '../components/Navbar'
import { ValidatedTextField } from '../components/ValidatedTextField'
import { useState } from 'react'
import { jsonHeaders } from '../queries'
import { useSnackbar } from 'notistack'
import { useAuth } from '../stores/auth'
import { useLocation } from 'wouter'
import { address } from '../config'

export default function AccountCreatePage() {
    const { enqueueSnackbar } = useSnackbar()
    const login = useAuth(state => state.login)

    const [, setLocation] = useLocation()

    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [isAdmin, setIsAdmin] = useState(true)

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        if (!e.currentTarget.checkValidity()) return
        const body = {
            username,
            password,
            isAdmin
        }
        fetch(`${address}/web-api/account/register`, {
            method: 'POST',
            credentials: 'include',
            ...jsonHeaders,
            body: JSON.stringify(body)
        }).then(res => {
            if (res.ok) {
                res.json().then(data => {
                    enqueueSnackbar('Account created', { variant: 'success' })
                    login(data)
                    setLocation('/')
                })
            } else {
                res.text().then(err =>
                    enqueueSnackbar(
                        `An error occured while creating account : ${err} (${res.status})`,
                        { variant: 'error' }
                    )
                )
            }
        })
    }

    return (
        <div>
            <Navbar />
            <Box className='f-col align-center' sx={{ m: 8 }}>
                <Typography component='h1' variant='h5'>
                    Create Account
                </Typography>
                <Box
                    component='form'
                    onSubmit={handleSubmit}
                    noValidate
                    sx={{
                        mt: 1,
                        width: { xs: '100%', sm: '25%' },
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center'
                    }}
                >
                    <ValidatedTextField
                        margin='normal'
                        required
                        fullWidth
                        label='Username'
                        autoComplete='username'
                        autoFocus
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        errorMessage='Username is required'
                    />
                    <ValidatedTextField
                        margin='normal'
                        required
                        fullWidth
                        label='Password'
                        type='password'
                        autoComplete='current-password'
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        errorMessage='Password is required'
                    />

                    <FormControlLabel
                        control={
                            <Switch
                                checked={isAdmin}
                                onChange={e => setIsAdmin(e.target.checked)}
                            />
                        }
                        label='Is Admin'
                    />
                    <Button
                        type='submit'
                        fullWidth
                        variant='contained'
                        sx={{ mt: 1, mb: 2 }}
                        disabled={!(username && password)}
                    >
                        Create Account
                    </Button>
                </Box>
            </Box>
        </div>
    )
}
