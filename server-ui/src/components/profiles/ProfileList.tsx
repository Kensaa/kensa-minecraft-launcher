import {
    Button,
    Card,
    CardActionArea,
    CardActions,
    CardContent,
    CircularProgress,
    Grid,
    Paper,
    Typography
} from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { fetchProfiles } from '../../queries'
import type { Profile } from 'utils'
import { useState } from 'react'
import ProfileEditModal from './ProfileEditModal'
import { useSnackbar } from 'notistack'

export default function ProfileList() {
    const { enqueueSnackbar } = useSnackbar()
    const [editProfile, setEditProfile] = useState<
        null | (Profile | undefined)
    >(null)

    const {
        data: profiles,
        isPending: profilesPending,
        isError: profilesError,
        refetch: profilesRefresh
    } = useQuery({
        queryKey: ['profiles'],
        queryFn: fetchProfiles
    })

    if (profilesPending) {
        return <CircularProgress />
    }

    if (profilesError) {
        enqueueSnackbar('failed to fetch data', { variant: 'error' })
        return
    }

    return (
        <>
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
                        <ProfileCard
                            key={i}
                            profile={profile}
                            onClick={() => setEditProfile(profile)}
                        />
                    ))}
                    <Card>
                        <CardActionArea
                            onClick={() => {
                                setEditProfile(undefined)
                            }}
                        >
                            <CardContent>
                                <Typography
                                    gutterBottom
                                    variant='h4'
                                    component='div'
                                >
                                    New Profile
                                </Typography>
                                <Typography variant='subtitle2'>
                                    Create a new profile
                                </Typography>
                            </CardContent>
                        </CardActionArea>
                    </Card>
                </Grid>
            </Paper>
            {editProfile !== null ? (
                <ProfileEditModal
                    open={editProfile !== null}
                    onClose={() => {
                        profilesRefresh()
                        setEditProfile(null)
                    }}
                    profile={editProfile}
                />
            ) : (
                ''
            )}
        </>
    )
}

interface ProfileCardProps {
    profile: Profile
    onClick: () => void
}
function ProfileCard({ profile, onClick }: ProfileCardProps) {
    return (
        <Card>
            <CardActionArea onClick={onClick}>
                <CardContent>
                    <Typography gutterBottom variant='h4' component='div'>
                        {profile.name}
                    </Typography>
                    <Typography variant='subtitle2'>
                        {getVersionString(profile.version)}
                    </Typography>
                </CardContent>
            </CardActionArea>
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
