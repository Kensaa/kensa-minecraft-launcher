import {
    Button,
    Card,
    CardActions,
    CardContent,
    Grid,
    Paper,
    Typography
} from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { fetchProfiles } from '../../queries'
import type { Profile } from '../../types'

export default function ProfileList() {
    const {
        data: profiles,
        isPending: profilesPending,
        isError: profilesError
    } = useQuery({
        queryKey: ['profiles'],
        queryFn: fetchProfiles
    })

    if (profilesPending) {
        return 'loading...'
    }
    if (profilesError) {
        return 'error'
    }

    return (
        <Paper>
            <Grid
                padding={1}
                container
                spacing={0}
                gap={4}
                justifyContent='center'
                alignItems='center'
            >
                {profiles.map((profile, i) => (
                    <ProfileCard key={i} profile={profile} />
                ))}
                <Card>
                    <CardContent>
                        <Typography gutterBottom variant='h4' component='div'>
                            New Profile
                        </Typography>
                        <Typography variant='subtitle2'>
                            Create a new profile
                        </Typography>
                    </CardContent>
                </Card>
            </Grid>
        </Paper>
    )
}

interface ProfileCardProps {
    profile: Profile
}
function ProfileCard({ profile }: ProfileCardProps) {
    return (
        <Card>
            <CardContent>
                <Typography gutterBottom variant='h4' component='div'>
                    {profile.name}
                </Typography>
                <Typography variant='subtitle2'>
                    {getVersionString(profile.version)}
                </Typography>
            </CardContent>
            <CardActions>
                <Button>Edit</Button>
                <Button color='error'>Delete</Button>
            </CardActions>
        </Card>
    )
}

function getVersionString(version: Profile['version']) {
    const { mc, forge } = version
    if (forge) {
        return `forge-${mc}-${forge}`
    }
    return mc
}
