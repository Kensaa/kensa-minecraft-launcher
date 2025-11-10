import {
    CircularProgress,
    FormControl,
    InputLabel,
    MenuItem,
    Select
} from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { fetchGameDirectories } from '../../queries'
import { useSnackbar } from 'notistack'

export interface GameDirectorySelectProps {
    value: string
    onChange: (newValue: string) => void
}
export default function GameDirectorySelect({
    value,
    onChange
}: GameDirectorySelectProps) {
    const { enqueueSnackbar } = useSnackbar()

    const {
        data: gameDirectories,
        isPending: gameDirectoriesPending,
        isError: gameDirectoriesError
    } = useQuery({
        queryFn: fetchGameDirectories,
        queryKey: ['game-directories']
    })
    if (gameDirectoriesPending) {
        return <CircularProgress />
    }

    if (gameDirectoriesError) {
        enqueueSnackbar('failed to fetch data', { variant: 'error' })
        return
    }

    return (
        <FormControl fullWidth sx={{ maxWidth: '200px' }}>
            <InputLabel id='game-directory-select-label'>
                Game Directory
            </InputLabel>
            <Select
                value={value}
                labelId='game-directory-select-label'
                label='Game Directory'
                onChange={e => onChange(e.target.value)}
            >
                <MenuItem>None</MenuItem>
                {gameDirectories.map((gameDirectory, i) => (
                    <MenuItem value={gameDirectory.name} key={i}>
                        {gameDirectory.name}
                    </MenuItem>
                ))}
            </Select>
        </FormControl>
    )
}
