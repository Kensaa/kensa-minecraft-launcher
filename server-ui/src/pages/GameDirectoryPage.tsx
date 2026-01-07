import { Box } from '@mui/material'
import { Redirect, useParams } from 'wouter'
import GameDirectoryViewer from '../components/gameDirectories/GameDirectoryViewer'
import Navbar from '../components/Navbar'

export default function GameDirectoryPage() {
    const { gameDirectoryName } = useParams()
    if (!gameDirectoryName) return <Redirect to='/' />
    return (
        <Box>
            <Navbar />
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center'
                }}
            >
                <GameDirectoryViewer gameDirectoryName={gameDirectoryName} />
            </Box>
        </Box>
    )
}
