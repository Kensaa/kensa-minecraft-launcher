import Modal, { type ModalProps } from '../Modal'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchGameDirectories, fetchMinecraftVersions } from '../../queries'
import {
    Box,
    Button,
    CircularProgress,
    MenuItem,
    TextField,
    Typography
} from '@mui/material'
import { ValidatedTextField } from '../ValidatedTextField'
import type { Profile } from 'utils'
import CreateGameDirectoryModal from '../CreateGameDirectoryModal'
import { useSnackbar } from 'notistack'
import { address } from '../../config'

type ProfileEditModalProps = Omit<ModalProps, 'children'> & {
    profile?: Profile // if profile === undefined -> create new profile
}
export default function ProfileEditModal({
    profile,
    ...props
}: ProfileEditModalProps) {
    const { enqueueSnackbar } = useSnackbar()

    const [name, setName] = useState<string>(profile?.name ?? '')
    const [version, setVersion] = useState<string>(profile?.version.mc ?? '')
    const [forge, setForge] = useState<string>(profile?.version.forge ?? '')
    const [gameDirectory, setGameDirectory] = useState<string>(
        profile?.gameDirectory ?? ''
    )
    const [createGameDirectory, setCreateGameDirectory] = useState(false)

    console.log(name, version, forge, gameDirectory)

    const {
        data: mcversions,
        isPending: mcVersionPending,
        isError: mcVersionError
    } = useQuery({
        queryFn: fetchMinecraftVersions,
        queryKey: ['mc-version'],
        staleTime: Infinity
    })

    const {
        data: gameDirectories,
        isPending: gameDirectoriesPending,
        isError: gameDirectoriesError,
        refetch: gameDirectoryRefresh
    } = useQuery({
        queryFn: fetchGameDirectories,
        queryKey: ['game-directories']
    })

    const currentForgesVersions = useMemo(() => {
        if (!mcversions) return []
        const v = mcversions.find(v => v.version === version)
        if (!v) {
            return []
        }
        return v.forgeVersions
    }, [version, mcversions])

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        if (!e.currentTarget.checkValidity()) return

        // Used to know if the currently selected forge version is a valid forge version for the current minceraft version
        const forgeValid = currentForgesVersions.find(v => v.version === forge)

        console.log(forgeValid)
        const body = {
            name,
            mcVersion: version,
            forgeVersion: forge !== '' && forgeValid ? forge : undefined,
            gameDirectory: gameDirectory !== '' ? gameDirectory : undefined
        }

        const isCreate = profile === undefined

        const url = `${address}/web-api/profile${
            isCreate ? '' : '/' + profile!.id
        }`

        fetch(url, {
            method: isCreate ? 'POST' : 'PATCH',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        }).then(res => {
            if (res.ok) {
                props.onClose()
            } else {
                res.text().then(text =>
                    enqueueSnackbar(text, { variant: 'error' })
                )
            }
        })
    }

    if (mcVersionPending || gameDirectoriesPending) {
        return (
            <Modal {...props}>
                <CircularProgress />
            </Modal>
        )
    }
    if (mcVersionError || gameDirectoriesError) {
        enqueueSnackbar('failed to fetch data', { variant: 'error' })
        props.onClose()
        return
    }

    return (
        <>
            <Modal {...props}>
                <Typography
                    variant='h4'
                    textAlign='center'
                    color='text.primary'
                >
                    Edit Profile
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
                    <TextField
                        margin='normal'
                        required
                        fullWidth
                        label='Version'
                        value={version}
                        select
                        onChange={e => setVersion(e.target.value)}
                    >
                        {/* <MenuItem value=''>Select a version</MenuItem> */}
                        {mcversions.map((v, i) => (
                            <MenuItem value={v.version} key={i}>
                                {v.version}
                            </MenuItem>
                        ))}
                    </TextField>
                    <TextField
                        margin='normal'
                        fullWidth
                        label='Forge Version'
                        value={version === '' ? '' : forge}
                        select
                        onChange={e => setForge(e.target.value)}
                        disabled={
                            version === '' || currentForgesVersions.length === 0
                        }
                    >
                        <MenuItem value=''>None</MenuItem>
                        {currentForgesVersions.map((forgeVersion, i) => (
                            <MenuItem key={i} value={forgeVersion.version}>
                                {forgeVersion.version}{' '}
                                {forgeVersion.latest ? '(latest)' : ''}{' '}
                                {forgeVersion.recommended
                                    ? '(recommended)'
                                    : ''}
                            </MenuItem>
                        ))}
                    </TextField>
                    <TextField
                        margin='normal'
                        fullWidth
                        label='Game Directory'
                        value={gameDirectory}
                        select
                        onChange={e => {
                            if (e.target.value === '__create_new__') {
                                setCreateGameDirectory(true)
                            } else {
                                setGameDirectory(e.target.value)
                            }
                        }}
                    >
                        <MenuItem value=''>None</MenuItem>
                        {gameDirectories.map((dir, i) => (
                            <MenuItem key={i} value={dir.name}>
                                {dir.name}
                            </MenuItem>
                        ))}
                        <MenuItem value='__create_new__'>
                            <b>Create new</b>
                        </MenuItem>
                    </TextField>
                    <Button
                        type='submit'
                        fullWidth
                        variant='contained'
                        sx={{ mt: 3, mb: 2 }}
                        disabled={name === '' || version === ''}
                    >
                        Confirm
                    </Button>
                </Box>
            </Modal>
            <CreateGameDirectoryModal
                onClose={() => setCreateGameDirectory(false)}
                onResult={res => {
                    gameDirectoryRefresh().then(() => setGameDirectory(res))
                }}
                open={createGameDirectory}
            />
        </>
    )
}
