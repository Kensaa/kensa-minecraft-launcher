import React, { useState } from 'react'
import {
    Button,
    Form,
    Modal,
    OverlayTrigger,
    Table,
    Tooltip
} from 'react-bootstrap'
import { Profile } from '../types'
import {
    useIsFetching,
    useLocalProfiles,
    useProfiles,
    useSelectedProfile
} from '../stores/profiles'
import LoadingSpinner from '../components/LoadingSpinner'

export default function ProfileManager() {
    const [editProfile, setEditProfile] = useState<Profile | undefined>()
    const [createProfile, setCreateProfile] = useState<boolean>(false)

    const { localProfiles, setLocalProfiles } = useLocalProfiles()
    const profiles = useProfiles()
    const { selectedProfile } = useSelectedProfile()
    const fetching = useIsFetching()

    if (fetching) return <LoadingSpinner />

    const cloneProfile = () => {
        if (!profiles) return
        const currentServer = profiles[selectedProfile[0]]
        if (!currentServer) return
        const profile = currentServer.profiles[selectedProfile[1]]
        if (!profile) return
        setEditProfile(profile)
    }

    return (
        <div className='h-100' style={{ overflowY: 'auto' }}>
            <Modal
                show={!!editProfile}
                onHide={() => setEditProfile(undefined)}
            >
                <Modal.Header closeButton>
                    <Modal.Title style={{ color: 'black' }}>
                        Editing Profile "{editProfile?.name}"
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <ProfileEdit
                        profile={editProfile}
                        hide={() => setEditProfile(undefined)}
                    />
                </Modal.Body>
            </Modal>

            <Modal show={createProfile} onHide={() => setCreateProfile(false)}>
                <Modal.Header closeButton>
                    <Modal.Title style={{ color: 'black' }}>
                        Creating a new Profile
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <ProfileEdit hide={() => setCreateProfile(false)} />
                </Modal.Body>
            </Modal>

            <Table>
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Version</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {localProfiles.map((profile, index) => (
                        <ProfileComponent
                            profile={profile}
                            key={index}
                            deleteProfile={() => {
                                setLocalProfiles(
                                    localProfiles.filter(p => p !== profile)
                                )
                            }}
                            edit={() => {
                                setEditProfile(profile)
                            }}
                        />
                    ))}
                </tbody>
            </Table>
            <div className='d-flex justify-content-center'>
                <Button className='mx-1' onClick={() => setCreateProfile(true)}>
                    Create new local profile
                </Button>
                <OverlayTrigger
                    placement='bottom'
                    overlay={
                        <Tooltip>
                            This converts the currently selected remote profile
                            to a local profile, making it accessible offline.
                            Don't forget to launch the remote profile at least
                            once so that the profile files can be downloaded.
                        </Tooltip>
                    }
                    delay={{ show: 500, hide: 0 }}
                >
                    <Button
                        className='mx-1'
                        onClick={cloneProfile}
                        disabled={
                            selectedProfile[0] == '' ||
                            selectedProfile[0] == 'local'
                        }
                    >
                        Convert remote profile to local
                    </Button>
                </OverlayTrigger>
            </div>
        </div>
    )
}

interface ProfileComponentProps {
    profile: Profile
    deleteProfile: () => void
    edit: () => void
}
function ProfileComponent({
    profile,
    deleteProfile,
    edit
}: ProfileComponentProps) {
    const versionString = profile.version.forge
        ? `forge-${profile.version.mc}`
        : `${profile.version.mc}`

    return (
        <tr>
            <td>{profile.name}</td>
            <td>{versionString}</td>
            <td>
                <Button className='mx-1' variant='success' onClick={edit}>
                    Edit
                </Button>
                <Button
                    className='mx-1'
                    variant='danger'
                    onClick={deleteProfile}
                >
                    Delete
                </Button>
            </td>
        </tr>
    )
}

interface ProfileEditProps {
    profile?: Profile
    hide: () => void
}

function ProfileEdit({ profile, hide }: ProfileEditProps) {
    const { localProfiles, setLocalProfiles } = useLocalProfiles()

    const [name, setName] = useState<string>(profile?.name ?? '')
    const [version, setVersion] = useState<string>(profile?.version.mc ?? '')
    const [forge, setForge] = useState<string>(profile?.version.forge ?? '')
    const [gameFolder, setGameFolder] = useState<string>(
        profile?.gameFolder ?? ''
    )

    const save = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        event.stopPropagation()
        const newProfile: Profile = {
            name,
            version: {
                mc: version,
                forge: forge && forge !== '' ? forge : undefined
            },
            gameFolder: gameFolder && gameFolder !== '' ? gameFolder : undefined
        }

        const newProfiles = localProfiles.filter(p => p !== profile)
        newProfiles.push(newProfile)
        setLocalProfiles(newProfiles)
        hide()
    }

    return (
        <Form onSubmit={save}>
            <Form.Group>
                <Form.Label>Name</Form.Label>
                <Form.Control
                    value={name}
                    onChange={({ target }) => setName(target.value)}
                    placeholder='name of the profile'
                />
            </Form.Group>
            <Form.Group>
                <Form.Label>Version</Form.Label>
                <Form.Control
                    value={version}
                    onChange={({ target }) => setVersion(target.value)}
                    placeholder='minecraft version of the profile'
                />
            </Form.Group>
            <Form.Group>
                <Form.Label>Forge Version</Form.Label>
                <Form.Control
                    value={forge}
                    onChange={({ target }) => setForge(target.value)}
                    placeholder='forge installer name of the profile (optional)'
                />
            </Form.Group>
            <Form.Group>
                <Form.Label>Game Folder</Form.Label>
                <Form.Control
                    value={gameFolder}
                    onChange={({ target }) => setGameFolder(target.value)}
                    placeholder='game folder of the profile (optional)'
                />
            </Form.Group>
            <Form.Group className='d-flex justify-content-center mt-2'>
                <Button
                    type='submit'
                    variant='success'
                    disabled={
                        name === '' ||
                        version === '' ||
                        (!profile && localProfiles.some(p => p.name === name))
                    }
                >
                    Save
                </Button>
            </Form.Group>
        </Form>
    )
}
