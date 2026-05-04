import { Box, Button, Tooltip } from '@mui/material'
import { Redirect, useParams } from 'wouter'
import GameDirectoryViewer from '../components/gameDirectories/GameDirectoryViewer'
import Navbar from '../components/Navbar'
import { address } from '../config'
import { useSnackbar } from 'notistack'
import { useQueryClient } from '@tanstack/react-query'

export default function GameDirectoryPage() {
    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()

    const { gameDirectoryName } = useParams()
    if (!gameDirectoryName) return <Redirect to='/' />

    const handleRefresh = () => {
        fetch(`${address}/web-api/gameDirectory/${gameDirectoryName}/refresh`, {
            method: 'POST',
            credentials: 'include'
        }).then(res => {
            if (res.ok) {
                queryClient.invalidateQueries({
                    queryKey: ['game-directory-files', gameDirectoryName]
                })
                enqueueSnackbar('Refreshed profile', { variant: 'success' })
            } else {
                res.text().then(err => {
                    enqueueSnackbar(
                        `An error occured while refreshing profile : ${err} (${res.status})`,
                        { variant: 'error' }
                    )
                })
            }
        })
    }

    return (
        <Box>
            <Navbar />
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    marginTop: '1rem'
                }}
            >
                <Tooltip
                    arrow
                    title='rescans every file present on the server, this should only be used if modification were made directly on the server and not through this page'
                >
                    <Button onClick={handleRefresh}>Refresh</Button>
                </Tooltip>
                <GameDirectoryViewer gameDirectoryName={gameDirectoryName} />
            </Box>
        </Box>
    )
}
