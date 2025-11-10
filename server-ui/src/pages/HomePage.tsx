import { Box } from '@mui/material'
import Navbar from '../components/Navbar'
import ProfileTable from '../components/profiles/ProfileTable'

export default function HomePage() {
    return (
        <Box>
            <Navbar />
            <ProfileTable />
        </Box>
    )
}
