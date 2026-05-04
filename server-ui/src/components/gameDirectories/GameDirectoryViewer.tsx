import React, { useMemo, useRef, useState } from 'react'
import {
    Box,
    CircularProgress,
    IconButton,
    Menu,
    MenuItem
} from '@mui/material'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { FileTreeElement, GameDirectory, Tree } from 'utils'
import { fetchGameDirectoriesFile, jsonHeaders } from '../../queries'
import { useSnackbar } from 'notistack'
import {
    RichTreeView,
    useTreeItemModel,
    type TreeViewBaseItem,
    type UseTreeItemParameters,
    TreeItemLabel,
    TreeItem,
    type UseTreeItemLabelSlotOwnProps,
    useTreeItemUtils,
    type UseTreeItemLabelInputSlotOwnProps,
    TreeItemLabelInput,
    useTreeViewApiRef
} from '@mui/x-tree-view'
import {
    ArticleRounded,
    CheckCircleOutline,
    CloseRounded,
    FolderRounded,
    FolderZipRounded
} from '@mui/icons-material'
import { address } from '../../config'
// See https://mui.com/x/react-tree-view/rich-tree-view/customization/

const archiveExt = ['.zip', '.tgz', '.tar.gz']
type FileType = 'File' | 'Dir' | 'Archive'
interface ExtendedFileExplorerItemProps {
    id: string // unique id of the file explorer item
    type: FileType
    label: string
    gameDirectoryName: string
    path: string[]
}

export interface GameDirectoryViewerProps {
    gameDirectoryName: GameDirectory['name']
}
export default function GameDirectoryViewer({
    gameDirectoryName
}: GameDirectoryViewerProps) {
    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()

    const apiRef = useTreeViewApiRef()

    const {
        isPending: filesPending,
        data: files,
        error: filesError
    } = useQuery({
        queryKey: ['game-directory-files', gameDirectoryName],
        queryFn: () => fetchGameDirectoriesFile(gameDirectoryName)
    })

    const rearrangedFiles: TreeViewBaseItem<ExtendedFileExplorerItemProps>[] =
        useMemo(() => {
            if (filesPending || filesError) return []

            function explore(
                t: Tree<FileTreeElement>,
                currPath: string[] = []
            ) {
                const curr: TreeViewBaseItem<ExtendedFileExplorerItemProps>[] =
                    []
                for (const [key, value] of Object.entries(t)) {
                    const nextPath = [...currPath, key]
                    if (
                        value.hash !== undefined &&
                        value.lastModified !== undefined
                    ) {
                        // is file
                        const fileType = archiveExt.some(ext =>
                            key.endsWith(ext)
                        )
                            ? 'Archive'
                            : 'File'

                        curr.push({
                            id: nextPath.join('-'),
                            path: nextPath,
                            label: key,
                            type: fileType,
                            gameDirectoryName
                        })
                    } else {
                        // is dir
                        curr.push({
                            id: nextPath.join('-'),
                            path: nextPath,
                            label: key,
                            type: 'Dir',
                            children: explore(
                                value as Tree<FileTreeElement>,
                                nextPath
                            ),
                            gameDirectoryName
                        })
                    }
                }
                return curr
            }

            return [
                {
                    id: '',
                    path: [],
                    label: gameDirectoryName,
                    type: 'Dir',
                    gameDirectoryName,
                    children: explore(files)
                }
            ]
        }, [files, filesError, filesPending, gameDirectoryName])

    if (filesPending) {
        return <CircularProgress />
    }
    if (filesError) {
        enqueueSnackbar('failed to fetch files', { variant: 'error' })
        return
    }

    const handleRename = (id: string, newName: string) => {
        const changedFile = apiRef.current?.getItem(id)
        if (!changedFile) return
        const newPath = [...changedFile.path]
        const oldName = newPath.pop()
        if (oldName == newName) return
        newPath.push(newName)
        fetch(
            `${address}/web-api/gameDirectory/${changedFile.gameDirectoryName}/move`,
            {
                method: 'POST',
                credentials: 'include',
                ...jsonHeaders,
                body: JSON.stringify({
                    old_filepath: changedFile.path.join('/'),
                    new_filepath: newPath.join('/')
                })
            }
        ).then(res => {
            if (res.ok) {
                queryClient.invalidateQueries({
                    queryKey: [
                        'game-directory-files',
                        changedFile.gameDirectoryName
                    ]
                })
                enqueueSnackbar('Renamed file', { variant: 'success' })
            } else {
                res.text().then(err => {
                    enqueueSnackbar(
                        `An error occured while renaming file : ${err} (${res.status})`,
                        { variant: 'error' }
                    )
                    // revert label
                    apiRef.current?.updateItemLabel(id, changedFile.label)
                })
            }
        })
    }

    return (
        <Box sx={{ mt: 1, width: { xs: '100%', sm: '25%' } }}>
            <RichTreeView
                items={rearrangedFiles}
                slots={{ item: FileExplorerItem }}
                apiRef={apiRef}
                isItemEditable={item => item.id !== ''}
                onItemLabelChange={handleRename}
                defaultExpandedItems={['']}
            />
        </Box>
    )
}

interface CustomLabelProps extends UseTreeItemLabelSlotOwnProps {
    icon?: React.ElementType
}

function CustomLabel({ icon: Icon, children, ...other }: CustomLabelProps) {
    return (
        <TreeItemLabel
            {...other}
            sx={{
                display: 'flex',
                alignItems: 'center'
            }}
        >
            {Icon && (
                <Box
                    component={Icon}
                    className='labelIcon'
                    color='inherit'
                    sx={{ mr: 1, fontSize: '1.2rem' }}
                />
            )}

            {children}
        </TreeItemLabel>
    )
}

interface CustomLabelInputProps extends UseTreeItemLabelInputSlotOwnProps {
    handleCancelItemLabelEditing: (event: React.SyntheticEvent) => void
    handleSaveItemLabel: (event: React.SyntheticEvent, label: string) => void
    value: string
}
function CustomLabelInput(props: Omit<CustomLabelInputProps, 'ref'>) {
    const {
        handleCancelItemLabelEditing,
        handleSaveItemLabel,
        value,
        ...other
    } = props

    return (
        <>
            <TreeItemLabelInput {...other} value={value} />
            <IconButton
                color='success'
                size='small'
                onClick={(event: React.MouseEvent) => {
                    handleSaveItemLabel(event, value)
                }}
            >
                <CheckCircleOutline fontSize='small' />
            </IconButton>
            <IconButton
                color='error'
                size='small'
                onClick={handleCancelItemLabelEditing}
            >
                <CloseRounded fontSize='small' />
            </IconButton>
        </>
    )
}

interface FileExplorerItemProps
    extends
        Omit<UseTreeItemParameters, 'rootRef'>,
        Omit<React.HTMLAttributes<HTMLLIElement>, 'onFocus'> {}

const FileExplorerItem = React.forwardRef(function (
    props: FileExplorerItemProps,
    ref: React.Ref<HTMLLIElement>
) {
    const { enqueueSnackbar, closeSnackbar } = useSnackbar()
    const queryClient = useQueryClient()
    const { itemId } = props

    const { interactions, publicAPI } = useTreeItemUtils({
        itemId: props.itemId,
        children: props.children
    })

    const item = useTreeItemModel<ExtendedFileExplorerItemProps>(itemId)!

    const icon =
        item.type === 'Dir'
            ? FolderRounded
            : item.type === 'Archive'
              ? FolderZipRounded
              : ArticleRounded

    const [isDragOver, setIsDragOver] = useState(false)
    const dragDepth = useRef(0)

    const [menuPos, setMenuPos] = useState<[number, number] | null>(null)

    const handleDragEnter = (event: React.DragEvent) => {
        if (item.type !== 'Dir') return
        event.preventDefault()
        event.stopPropagation()

        dragDepth.current += 1
        if (dragDepth.current === 1) {
            setIsDragOver(true)
        }
    }

    const handleDragLeave = (event: React.DragEvent) => {
        if (item.type !== 'Dir') return
        event.preventDefault()
        event.stopPropagation()

        dragDepth.current -= 1
        if (dragDepth.current <= 0) {
            dragDepth.current = 0
            setIsDragOver(false)
        }
    }

    const handleDragOver = (event: React.DragEvent) => {
        if (item.type === 'Dir') event.preventDefault()
    }

    interface LocalMoveData {
        path: string[]
        type: FileType
    }
    const onDrop = async (event: React.DragEvent) => {
        event.preventDefault()
        if (item.type === 'File') return
        setIsDragOver(false)
        dragDepth.current = 0
        event.stopPropagation()

        const files = event.dataTransfer.files

        if (files.length === 0) {
            const data = event.dataTransfer.getData(
                'application/x-local-file-move'
            )
            if (!data) return
            console.log(item)
            // local file => file move
            const localMoveData = JSON.parse(data) as LocalMoveData
            const oldFilepath = localMoveData.path.join('/')
            const filename = localMoveData.path[localMoveData.path.length - 1]

            const newFilepathPart = [...item.path]
            // if the target on which the file is dropped is another file (ie not a directory), the move destination should be the containing directory
            if (item.type !== 'Dir') newFilepathPart.pop()
            const newFilepath = [...newFilepathPart, filename].join('/')

            if (oldFilepath === newFilepath) return

            fetch(
                `${address}/web-api/gameDirectory/${item.gameDirectoryName}/move`,
                {
                    method: 'POST',
                    credentials: 'include',
                    ...jsonHeaders,
                    body: JSON.stringify({
                        old_filepath: oldFilepath,
                        new_filepath: newFilepath
                    })
                }
            ).then(res => {
                if (res.ok) {
                    queryClient.invalidateQueries({
                        queryKey: [
                            'game-directory-files',
                            item.gameDirectoryName
                        ]
                    })
                } else {
                    res.text().then(err => {
                        enqueueSnackbar(
                            `An error occured while moving file : ${err} (${res.status})`,
                            { variant: 'error' }
                        )
                    })
                }
            })
        } else {
            // dragged file is an external file => upload
            const uploadPormises: Promise<void>[] = []
            for (const file of files) {
                const notifKey = enqueueSnackbar(
                    `Uploading file "${file.name}"`,
                    {
                        variant: 'info'
                    }
                )
                const formData = new FormData()
                const filepath = [...item.path]
                filepath.push(file.name)
                formData.append('filepath', filepath.join('/'))
                formData.append('file', file)
                const uploadPromise = fetch(
                    `${address}/web-api/gameDirectory/${item.gameDirectoryName}/file`,
                    { method: 'POST', credentials: 'include', body: formData }
                ).then(res => {
                    closeSnackbar(notifKey)
                    if (res.ok) {
                        enqueueSnackbar(`"${file.name}" uploaded`, {
                            variant: 'success'
                        })
                    } else {
                        res.text().then(err => {
                            enqueueSnackbar(
                                `Failed to upload "${file.name}" : ${err} (${res.status})`,
                                { variant: 'error' }
                            )
                        })
                    }
                })
                uploadPormises.push(uploadPromise)
            }
            await Promise.all(uploadPormises)
            queryClient.invalidateQueries({
                queryKey: ['game-directory-files', item.gameDirectoryName]
            })
        }
    }

    const handleDragStart = (event: React.DragEvent) => {
        if (item.id === '') return event.preventDefault()
        event.stopPropagation()

        const move: LocalMoveData = {
            path: item.path,
            type: item.type
        }
        event.dataTransfer.setData(
            'application/x-local-file-move',
            JSON.stringify(move)
        )
        event.dataTransfer.effectAllowed = 'move'
    }

    const handleContextMenu = (event: React.MouseEvent) => {
        event.preventDefault()
        event.stopPropagation()
        setMenuPos(null)
        setTimeout(() => {
            setMenuPos([event.clientX, event.clientY])
        }, 0)
    }

    const handleDelete = () => {
        if (item.id === '') return
        fetch(
            `${address}/web-api/gameDirectory/${item.gameDirectoryName}/file`,
            {
                method: 'DELETE',
                credentials: 'include',
                ...jsonHeaders,
                body: JSON.stringify({
                    filepath: item.path.join('/')
                })
            }
        ).then(res => {
            if (res.ok) {
                enqueueSnackbar(`"${item.label}" deleted`, {
                    variant: 'success'
                })
                queryClient.invalidateQueries({
                    queryKey: ['game-directory-files', item.gameDirectoryName]
                })
            } else {
                res.text().then(err => {
                    enqueueSnackbar(
                        `Failed to delete "${item.label}" : ${err} (${res.status})`,
                        { variant: 'error' }
                    )
                })
            }
        })
    }

    const handleUncompress = () => {
        if (item.id === '') return
        fetch(
            `${address}/web-api/gameDirectory/${item.gameDirectoryName}/uncompress`,
            {
                method: 'POST',
                credentials: 'include',
                ...jsonHeaders,
                body: JSON.stringify({
                    filepath: item.path.join('/')
                })
            }
        ).then(res => {
            if (res.ok) {
                enqueueSnackbar(`"${item.label}" uncompressed`, {
                    variant: 'success'
                })
                queryClient.invalidateQueries({
                    queryKey: ['game-directory-files', item.gameDirectoryName]
                })
            } else {
                res.text().then(err => {
                    enqueueSnackbar(
                        `Failed to uncompress "${item.label}" : ${err} (${res.status})`,
                        { variant: 'error' }
                    )
                })
            }
        })
    }

    const handleInputBlur: UseTreeItemLabelInputSlotOwnProps['onBlur'] =
        event => {
            setTimeout(() => {
                interactions.handleCancelItemLabelEditing(event)
            }, 0)
        }

    const handleClick = (event: React.MouseEvent) => {
        event.preventDefault()
        event.stopPropagation()
        interactions.handleExpansion(event)
    }

    return (
        <>
            <TreeItem
                {...props}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDragStart={handleDragStart}
                onDrop={onDrop}
                draggable={true}
                onContextMenu={handleContextMenu}
                onClick={handleClick}
                ref={ref}
                slots={{ label: CustomLabel, labelInput: CustomLabelInput }}
                slotProps={{
                    label: {
                        icon: icon
                    } as Partial<CustomLabelProps>,
                    labelInput: {
                        icon: icon,
                        handleCancelItemLabelEditing:
                            interactions.handleCancelItemLabelEditing,
                        handleSaveItemLabel: interactions.handleSaveItemLabel,
                        onBlur: handleInputBlur
                    } as Partial<CustomLabelInputProps>
                }}
                style={{
                    backgroundColor: isDragOver
                        ? 'rgba(25, 118, 210, 0.1)'
                        : undefined
                }}
            />
            <Menu
                anchorReference='anchorPosition'
                anchorPosition={
                    menuPos !== null
                        ? {
                              left: menuPos[0],
                              top: menuPos[1]
                          }
                        : undefined
                }
                open={Boolean(menuPos)}
                onClick={e => e.stopPropagation()} // To stop existing the menu expending item behind
                onClose={() => {
                    setMenuPos(null)
                }}
            >
                {item.type === 'Dir' ? (
                    <MenuItem
                        onClick={e => {
                            e.preventDefault()
                            e.stopPropagation()
                            setMenuPos(null)

                            function makeRequest(
                                i: number
                            ): Promise<string[] | undefined> {
                                const dirname =
                                    i === 0
                                        ? `New Directory`
                                        : `New Directory (${i})`

                                const dirpath = [...item.path, dirname]

                                return fetch(
                                    `${address}/web-api/gameDirectory/${item.gameDirectoryName}/mkdir`,
                                    {
                                        method: 'POST',
                                        credentials: 'include',
                                        ...jsonHeaders,
                                        body: JSON.stringify({
                                            dirpath: dirpath.join('/')
                                        })
                                    }
                                ).then(res => {
                                    if (!res.ok) {
                                        if (res.status === 409) {
                                            return makeRequest(i + 1)
                                        } else {
                                            res.text().then(err => {
                                                enqueueSnackbar(
                                                    `An error occured while creating directory : ${err} (${res.status})`
                                                )
                                            })
                                        }
                                    } else {
                                        return dirpath
                                    }
                                })
                            }

                            makeRequest(0).then(dirpath => {
                                if (dirpath) {
                                    queryClient
                                        .refetchQueries({
                                            queryKey: [
                                                'game-directory-files',
                                                item.gameDirectoryName
                                            ]
                                        })
                                        .then(() => {
                                            setTimeout(() => {
                                                publicAPI.setEditedItem!(
                                                    dirpath.join('-')
                                                )
                                            }, 0)
                                        })
                                }
                            })
                        }}
                    >
                        New Directory
                    </MenuItem>
                ) : undefined}
                {item.type === 'Archive' ? (
                    <MenuItem
                        onClick={e => {
                            e.preventDefault()
                            e.stopPropagation()
                            setMenuPos(null)
                            handleUncompress()
                        }}
                    >
                        Uncompress
                    </MenuItem>
                ) : undefined}
                {item.type === 'Archive' || item.type === 'File' ? (
                    <MenuItem
                        component={'a'}
                        href={`${address}/static/gameDirectories/${item.gameDirectoryName}/${item.path.join('/')}`}
                        download={item.path[item.path.length - 1]}
                    >
                        Download
                    </MenuItem>
                ) : undefined}
                <MenuItem
                    onClick={e => {
                        e.preventDefault()
                        e.stopPropagation()
                        setMenuPos(null)
                        setTimeout(() => {
                            interactions.toggleItemEditing()
                        }, 0)
                    }}
                >
                    Rename
                </MenuItem>
                <MenuItem
                    onClick={e => {
                        e.preventDefault()
                        e.stopPropagation()
                        setMenuPos(null)
                        handleDelete()
                    }}
                >
                    Delete
                </MenuItem>
            </Menu>
        </>
    )
})
