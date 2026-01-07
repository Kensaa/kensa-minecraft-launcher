import {
    DataGrid,
    GridActionsCellItem,
    GridEditSingleSelectCell,
    GridRowEditStopReasons,
    GridRowModes,
    ToolbarButton,
    type GridColDef,
    type GridEventListener,
    type GridRenderEditCellParams,
    type GridRowId,
    type GridRowModel,
    type GridRowModesModel,
    type GridRowsProp,
    type GridSlotProps
} from '@mui/x-data-grid'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
    fetchGameDirectories,
    fetchMinecraftVersions,
    fetchProfiles,
    jsonHeaders
} from '../../queries'
import { CircularProgress, Tooltip, Typography } from '@mui/material'
import { useSnackbar } from 'notistack'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
    Add,
    Cancel,
    Delete,
    Edit,
    FileUpload,
    Folder,
    Save
} from '@mui/icons-material'
import type { MinecraftVersion } from 'utils'
import CreateGameDirectoryModal from '../gameDirectories/CreateGameDirectoryModal'
import { address } from '../../config'
import { Toolbar } from '@mui/x-data-grid'
import { useLocation } from 'wouter'
// See https://mui.com/x/react-data-grid/editing/

function GameDirectoryEditCell(props: GridRenderEditCellParams) {
    const queryClient = useQueryClient()
    const { id, field, api, value } = props

    useEffect(() => {
        // in case we are creating a new game directory, remove sentinel value triggering creation
        if (value === '__new__') {
            api.setEditCellValue({
                id,
                field,
                value: ''
            })
        }
    }, [api, field, id, value])

    const [createGameDirectory, setCreateGameDirectory] = useState(false)

    return (
        <>
            <GridEditSingleSelectCell
                onValueChange={(_, val) => {
                    if (val === '__new__') {
                        setCreateGameDirectory(true)
                    }
                }}
                {...props}
            />
            <CreateGameDirectoryModal
                onClose={() => setCreateGameDirectory(false)}
                onResult={res => {
                    queryClient
                        .refetchQueries({
                            queryKey: ['game-directories']
                        })
                        .then(() => {
                            api.setEditCellValue({
                                id,
                                field,
                                value: res
                            })
                        })
                }}
                open={createGameDirectory}
            />
        </>
    )
}

declare module '@mui/x-data-grid' {
    interface ToolbarPropsOverrides {
        setRows: (newRows: (oldRows: GridRowsProp) => GridRowsProp) => void
        setRowModesModel: (
            newModel: (oldModel: GridRowModesModel) => GridRowModesModel
        ) => void
    }
}
function EditToolbar(props: GridSlotProps['toolbar']) {
    const { setRows, setRowModesModel } = props
    const fileInputRef = useRef<null | HTMLInputElement>(null)
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()

    const handleAddProfile = () => {
        const id = ''
        setRows(oldRows => [
            ...oldRows,
            {
                id,
                name: '',
                gameDirectory: '',
                mcVersion: '',
                forgeVersion: '',
                isNew: true
            }
        ])
        setRowModesModel(oldModel => ({
            ...oldModel,
            [id]: { mode: GridRowModes.Edit, fieldToFocus: 'name' }
        }))
    }

    const handleImportProfiles = () => {
        if (fileInputRef.current) fileInputRef.current.click()
    }
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!event.target.files) return
        if (event.target.files.length === 0) return
        const file = event.target.files[0]

        const reader = new FileReader()
        reader.addEventListener('load', event => {
            if (!event.target) return
            const result = event.target.result as string
            try {
                JSON.parse(result)
            } catch {
                enqueueSnackbar('Selected file is not valid JSON', {
                    variant: 'error'
                })
            }
            return fetch(`${address}/web-api/profile/import`, {
                method: 'POST',
                credentials: 'include',
                ...jsonHeaders,
                body: result
            }).then(res => {
                if (res.ok) {
                    queryClient
                        .refetchQueries({
                            queryKey: ['profiles', 'game-directories']
                        })
                        .then(() => {
                            enqueueSnackbar('Profiles imported', {
                                variant: 'success'
                            })
                        })
                } else {
                    res.text().then(err => {
                        enqueueSnackbar(
                            `An error occured while importing profiles : ${err} (${res.status})`,
                            { variant: 'error' }
                        )
                    })
                }
            })
        })
        reader.readAsText(file)
    }

    return (
        <Toolbar>
            <Typography fontWeight='medium' sx={{ flex: 1, mx: 0.5 }}>
                Profiles
            </Typography>
            <Tooltip title='Add profile'>
                <ToolbarButton onClick={handleAddProfile}>
                    <Add fontSize='small' />
                </ToolbarButton>
            </Tooltip>
            <Tooltip title='Import profiles from file'>
                <ToolbarButton onClick={handleImportProfiles}>
                    <FileUpload fontSize='small' />
                </ToolbarButton>
            </Tooltip>
            <input
                type='file'
                ref={fileInputRef}
                accept='.json'
                onChange={handleFileChange}
                style={{ display: 'none' }}
            />
        </Toolbar>
    )
}
export default function ProfileTable() {
    const { enqueueSnackbar } = useSnackbar()
    const [, setLocation] = useLocation()

    const [rowModesModel, setRowModesModel] = useState<GridRowModesModel>({})

    const {
        data: profiles,
        isPending: profilesPending,
        isError: profilesError
    } = useQuery({
        queryKey: ['profiles'],
        queryFn: fetchProfiles
    })

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
        isError: gameDirectoriesError
    } = useQuery({
        queryFn: fetchGameDirectories,
        queryKey: ['game-directories']
    })

    const [gridRows, setGridRows] = useState<GridRowsProp>([])

    useEffect(() => {
        if (profiles === undefined) {
            setGridRows([])
            return
        }

        const rows = profiles.map(profile => ({
            id: profile.id,
            name: profile.name,
            gameDirectory: profile.gameDirectory ?? '',
            mcVersion: profile.version.mc ?? '',
            forgeVersion: profile.version.forge ?? ''
        }))
        setGridRows(rows)
    }, [profiles])

    const columns: GridColDef[] = useMemo(() => {
        const handleCancelClick = (id: GridRowId) => () => {
            setRowModesModel({
                ...rowModesModel,
                [id]: { mode: GridRowModes.View, ignoreModifications: true }
            })
            const editedRow = gridRows.find(row => row.id === id)
            if (editedRow!.isNew) {
                setGridRows(gridRows.filter(row => row.id !== id))
            }
        }

        const handleEditClick = (id: GridRowId) => () => {
            setRowModesModel({
                ...rowModesModel,
                [id]: { mode: GridRowModes.Edit }
            })
        }

        const handleSaveClick = (id: GridRowId) => () => {
            setRowModesModel({
                ...rowModesModel,
                [id]: { mode: GridRowModes.View }
            })
        }
        const handleDeleteClick = (id: GridRowId) => () => {
            setGridRows(gridRows.filter(row => row.id !== id))

            fetch(`${address}/web-api/profile/${id}`, {
                method: 'DELETE',
                credentials: 'include'
            }).then(res => {
                if (res.ok) {
                    enqueueSnackbar('Profile Deleted', { variant: 'success' })
                } else {
                    res.text().then(err => {
                        enqueueSnackbar(
                            `An error occured while renaming file : ${err} (${res.status})`,
                            { variant: 'error' }
                        )
                    })
                }
            })
        }

        const handleEditGameDirectory = (id: GridRowId) => () => {
            const row = gridRows.find(row => row.id === id)
            if (!row) return
            if (row.gameDirectory === '') return

            setLocation(`/gameDirectory/${row.gameDirectory}`)
        }

        return [
            {
                field: 'name',
                headerName: 'Name',
                type: 'string',
                editable: true,
                flex: 1
            },
            {
                field: 'mcVersion',
                headerName: 'Minecraft Version',
                type: 'singleSelect',
                valueOptions: (mcversions ?? []).map(
                    version => version.version
                ),
                editable: true,
                flex: 1
            },
            {
                field: 'forgeVersion',
                headerName: 'Forge Version',
                type: 'singleSelect',
                valueOptions: param => {
                    const noneOptions = { value: '', label: 'None' }
                    if (!param.row.mcVersion) return [noneOptions]
                    const version = (mcversions ?? []).find(
                        v => v.version === param.row.mcVersion
                    )
                    if (!version) return [noneOptions]

                    return [
                        noneOptions,
                        ...version.forgeVersions.map(v => ({
                            value: v.version,
                            label: forgeVersionToString(v)
                        }))
                    ]
                },
                editable: true,
                flex: 1
            },
            {
                field: 'gameDirectory',
                headerName: 'Game Directory',
                valueFormatter: val => {
                    if (val === '') return 'None'
                    return val
                },
                getOptionLabel: (opt: { value: string; label: string }) => (
                    <Typography
                        sx={{
                            fontWeight:
                                opt.value === '__new__' ? 'bold' : 'normal'
                        }}
                    >
                        {opt.label}
                    </Typography>
                ),
                getOptionValue: (opt: { value: string; label: string }) =>
                    opt.value,

                renderEditCell: params => <GameDirectoryEditCell {...params} />,
                type: 'singleSelect',
                valueOptions: () => {
                    return [
                        { value: '', label: 'None' },
                        ...(gameDirectories ?? []).map(v => ({
                            value: v.name,
                            label: v.name
                        })),
                        { value: '__new__', label: 'Create New' }
                    ]
                },
                editable: true,
                flex: 1
            },
            {
                field: 'actions',
                type: 'actions',
                headerName: 'Actions',
                flex: 1,
                cellClassName: 'actions',
                getActions: ({ id }) => {
                    const isInEditMode =
                        rowModesModel[id]?.mode === GridRowModes.Edit

                    if (isInEditMode) {
                        return [
                            <Tooltip title='Save changes'>
                                <GridActionsCellItem
                                    icon={<Save />}
                                    label='Save'
                                    className='textPrimary'
                                    onClick={handleSaveClick(id)}
                                    color='inherit'
                                />
                            </Tooltip>,
                            <Tooltip title='Cancel changes'>
                                <GridActionsCellItem
                                    icon={<Cancel />}
                                    label='Cancel'
                                    className='textPrimary'
                                    onClick={handleCancelClick(id)}
                                    color='inherit'
                                />
                            </Tooltip>
                        ]
                    } else {
                        return [
                            <Tooltip title='Edit profile'>
                                <GridActionsCellItem
                                    icon={<Edit />}
                                    label='Edit'
                                    className='textPrimary'
                                    onClick={handleEditClick(id)}
                                    color='inherit'
                                />
                            </Tooltip>,

                            <Tooltip title='Delete profile'>
                                <GridActionsCellItem
                                    icon={<Delete />}
                                    label='Delete'
                                    className='textPrimary'
                                    onClick={handleDeleteClick(id)}
                                    color='inherit'
                                />
                            </Tooltip>,

                            <Tooltip title='Edit game directory'>
                                <GridActionsCellItem
                                    icon={<Folder />}
                                    label='Edit game directory'
                                    className='textPrimary'
                                    onClick={handleEditGameDirectory(id)}
                                    color='inherit'
                                    disabled={
                                        gridRows.find(grid => grid.id === id)!
                                            .gameDirectory === ''
                                    }
                                />
                            </Tooltip>
                        ]
                    }
                }
            }
        ]
    }, [
        gridRows,
        mcversions,
        gameDirectories,
        rowModesModel,
        enqueueSnackbar,
        setLocation
    ])

    const processRowUpdate = async (newRow: GridRowModel) => {
        const { name, mcVersion, forgeVersion, gameDirectory } = newRow
        if (name === '') {
            // enqueueSnackbar('Invalid profile name', { variant: 'error' })
            throw 'Invalid profile name'
        }
        if (mcVersion === '') {
            // enqueueSnackbar('Invalid Minecraft version', { variant: 'error' })
            throw 'Invalid Minecraft version'
        }
        const requestBody = {
            name: name,
            mcVersion: mcVersion,
            forgeVersion: forgeVersion !== '' ? forgeVersion : undefined,
            gameDirectory: gameDirectory !== '' ? gameDirectory : undefined
        }
        if (newRow.isNew) {
            // create new profile
            return fetch(`${address}/web-api/profile`, {
                method: 'POST',
                credentials: 'include',
                ...jsonHeaders,
                body: JSON.stringify(requestBody)
            }).then(res => {
                return res.text().then(resText => {
                    if (res.ok) {
                        const newId = parseInt(resText)
                        const profile = { ...newRow, isNew: false, id: newId }
                        setGridRows(
                            gridRows.map(row =>
                                row.id === newRow.id ? profile : row
                            )
                        )
                        enqueueSnackbar('Profile created', {
                            variant: 'success'
                        })
                        return profile
                    } else {
                        throw `An error occured while creating profile : ${resText} (${res.status})`
                    }
                })
            })
        } else {
            // edit existing profile
            return fetch(`${address}/web-api/profile/${newRow.id}`, {
                method: 'PATCH',
                credentials: 'include',
                ...jsonHeaders,
                body: JSON.stringify(requestBody)
            }).then(res => {
                return res.text().then(resText => {
                    if (res.ok) {
                        enqueueSnackbar('Profile updated', {
                            variant: 'success'
                        })
                        setGridRows(
                            gridRows.map(row =>
                                row.id === newRow.id ? newRow : row
                            )
                        )
                        return newRow
                    } else {
                        throw `An error occured while updating profile : ${resText} (${res.status})`
                    }
                })
            })
        }
    }

    const handleRowEditStop: GridEventListener<'rowEditStop'> = (
        params,
        event
    ) => {
        if (params.reason === GridRowEditStopReasons.rowFocusOut) {
            event.defaultMuiPrevented = true
        }
    }

    if (profilesPending || mcVersionPending || gameDirectoriesPending) {
        return <CircularProgress />
    }

    if (profilesError || mcVersionError || gameDirectoriesError) {
        enqueueSnackbar('failed to fetch data', { variant: 'error' })
        return
    }

    return (
        <DataGrid
            columns={columns}
            rows={gridRows}
            editMode='row'
            rowModesModel={rowModesModel}
            onRowModesModelChange={newModes => setRowModesModel(newModes)}
            processRowUpdate={processRowUpdate}
            onProcessRowUpdateError={err =>
                enqueueSnackbar(err, { variant: 'error' })
            }
            onRowEditStop={handleRowEditStop}
            slots={{ toolbar: EditToolbar }}
            slotProps={{
                toolbar: { setRows: setGridRows, setRowModesModel }
            }}
            showToolbar
        />
    )
}

function forgeVersionToString(
    forgeVersion: MinecraftVersion['forgeVersions'][number]
): string {
    const recPart = forgeVersion.recommended ? '(recommended)' : ''
    const latestPart = forgeVersion.latest ? '(latest)' : ''

    return `${forgeVersion.version} ${recPart} ${latestPart}`.trim()
}
