import { Box } from '@mui/material'
import Navbar from '../components/Navbar'
import ProfileTable from '../components/profiles/ProfileTable'
import { useState } from 'react'
import GameDirectorySelect from '../components/gameDirectories/GameDirectorySelect'
import GameDirectoryViewer from '../components/gameDirectories/GameDirectoryViewer'
import GameDirectoryRefresh from '../components/gameDirectories/GameDirectoryRefresh'

export default function HomePage() {
    const [selectedGameDirectory, setSelectedGameDirectory] = useState('')

    return (
        <Box>
            <Navbar />
            <ProfileTable />

            <Box sx={{ display: 'flex', flexDirection: 'column', mt: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <GameDirectorySelect
                        value={selectedGameDirectory}
                        onChange={setSelectedGameDirectory}
                    />
                    <GameDirectoryRefresh
                        gameDirectoryName={selectedGameDirectory}
                    />
                </Box>
                {selectedGameDirectory !== '' ? (
                    <GameDirectoryViewer
                        gameDirectoryName={selectedGameDirectory}
                    />
                ) : (
                    ''
                )}
            </Box>
        </Box>
    )
}
