import { Refresh } from '@mui/icons-material'
import { IconButton, Tooltip } from '@mui/material'
import { address } from '../../config'
import { useSnackbar } from 'notistack'
import { useQueryClient } from '@tanstack/react-query'

export interface GameDirectoryRefreshProps {
    gameDirectoryName?: string
}
export default function GameDirectoryRefresh({
    gameDirectoryName
}: GameDirectoryRefreshProps) {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const handleClick = () => {
        fetch(`${address}/web-api/gameDirectory/${gameDirectoryName}/refresh`, {
            method: 'POST',
            credentials: 'include'
        }).then(res => {
            res.text().then(resText => {
                if (res.ok) {
                    queryClient.invalidateQueries({
                        queryKey: ['game-directory-files', gameDirectoryName]
                    })
                    enqueueSnackbar('Game directory refreshed', {
                        variant: 'success'
                    })
                } else {
                    enqueueSnackbar(
                        `An error occured while refreshing game direectory : ${resText} (${res.status})`,
                        { variant: 'error' }
                    )
                }
            })
        })
    }

    return (
        <Tooltip title='Refresh game directory'>
            <IconButton
                onClick={handleClick}
                disabled={
                    gameDirectoryName === undefined || gameDirectoryName === ''
                }
            >
                <Refresh />
            </IconButton>
        </Tooltip>
    )
}
