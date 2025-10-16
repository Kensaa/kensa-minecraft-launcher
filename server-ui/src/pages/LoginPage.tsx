import React, { useState } from 'react'
import { Box, Button, Typography } from '@mui/material'
import { useAuth } from '../stores/auth'
import { useLocation } from 'wouter'
import Navbar from '../components/Navbar'
import { ValidatedTextField } from '../components/ValidatedTextField'
import { address } from '../config'
import Error from '../components/Error'

export default function LoginPage() {
    const login = useAuth(state => state.login)

    const [, setLocation] = useLocation()

    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')

    const [error, setError] = useState<string | null>(null)

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        if (!e.currentTarget.checkValidity()) return

        const body = {
            username,
            password
        }

        fetch(`${address}/web-api/account/login`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        }).then(res => {
            if (res.ok) {
                res.json().then(data => {
                    login(data)
                    setLocation('/')
                })
            } else {
                res.text().then(text => setError(text))
            }
        })
    }

    return (
        <div>
            <Navbar />
            <Error error={error} hide={() => setError(null)} />
            <Box className='f-col align-center' sx={{ m: 8 }}>
                <Typography component='h1' variant='h5'>
                    Login
                </Typography>
                <Box
                    component='form'
                    onSubmit={handleSubmit}
                    noValidate
                    sx={{ mt: 1, width: { xs: '100%', sm: '25%' } }}
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
                    <Button
                        type='submit'
                        fullWidth
                        variant='contained'
                        sx={{ mt: 3, mb: 2 }}
                        disabled={!(username && password)}
                    >
                        Login
                    </Button>
                </Box>
            </Box>
        </div>
    )
}
