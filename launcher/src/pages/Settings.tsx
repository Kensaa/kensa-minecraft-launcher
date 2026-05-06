import { ipcRenderer } from 'electron'
import { FileSearch, FolderSearch } from 'lucide-react'
import React, { useMemo, useState } from 'react'
import { Button, Form } from 'react-bootstrap'
import { useConfig } from '../stores/config'

interface SettingsProps {
    hide: () => void
    showServerManager: () => void
    showProfileManager: () => void
}

type SettingValue = string | number | boolean
type Setter = (s: SettingValue) => void

export default function Settings({
    hide,
    showServerManager,
    showProfileManager
}: SettingsProps) {
    const config = useConfig()

    const [rootDir, setRootDir] = useState(config.rootDir)
    const [ram, setRam] = useState(config.ram)
    const [closeLauncher, setCloseLauncher] = useState(config.closeLauncher)
    const [openLogs, setOpenLogs] = useState(config.openLogs)
    const [showHiddenProfiles, setShowHiddenProfiles] = useState(
        config.showHiddenProfiles
    )

    const [validated, setValidated] = useState(false)

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        config.setRootDir(rootDir)
        config.setRam(ram)
        config.setCloseLauncher(closeLauncher)
        config.setOpenLogs(openLogs)
        config.setShowHiddenProfiles(showHiddenProfiles)

        setValidated(true)
        hide()
    }

    const systemRam = useMemo(() => {
        const res = ipcRenderer.sendSync('get-system-ram')
        return res as number
    }, [])

    const resetConfig = () => {
        hide()
        config.resetConfig()
    }

    return (
        <Form
            onSubmit={handleSubmit}
            validated={validated}
            className='w-100 h-100 d-flex flex-column px-2'
        >
            <div style={{ flexGrow: 1 }} className='w-100'>
                <DirInput
                    label='Game folder'
                    value={rootDir}
                    setter={setRootDir as Setter}
                />
                <NumberInput
                    label='RAM (MiB)'
                    value={ram}
                    setter={setRam as Setter}
                    min={500}
                    max={systemRam}
                />
                <BooleanInput
                    label='Close launcher when the game launches'
                    value={closeLauncher}
                    setter={setCloseLauncher as Setter}
                />
                <BooleanInput
                    label='Open logs when game starts'
                    value={openLogs}
                    setter={setOpenLogs as Setter}
                />
                <BooleanInput
                    label='Show hidden profiles'
                    value={showHiddenProfiles}
                    setter={setShowHiddenProfiles as Setter}
                />
                <div className='d-flex justify-content-center mb-1 mt-2'>
                    <Button className='mx-1 flex-grow' onClick={resetConfig}>
                        Reset Config
                    </Button>
                </div>
                <div className='d-flex justify-content-center my-1'>
                    <Button
                        className='mx-1 flex-grow'
                        onClick={() => {
                            hide()
                            showServerManager()
                        }}
                    >
                        Server Manager
                    </Button>
                    <Button
                        className='mx-1 flex-grow'
                        onClick={() => {
                            hide()
                            showProfileManager()
                        }}
                    >
                        Local Profile Manager
                    </Button>
                </div>
                <div className='d-flex justify-content-center my-1'>
                    <Button
                        className='mx-1 flex-grow'
                        onClick={() => {
                            ipcRenderer.invoke('open-logs')
                            hide()
                        }}
                    >
                        Open Logs
                    </Button>
                </div>
                <div className='d-flex justify-content-center my-1'>
                    <Button className='mx-1 flex-grow' type='submit'>
                        Save
                    </Button>
                </div>
            </div>
        </Form>
    )
}

interface InputProps {
    label: string
    value: string | number | boolean
    placeholder?: string
    setter: Setter
}

interface GenericInputProps extends InputProps {
    children: React.ReactNode
}

function GenericInput({ children, ...props }: GenericInputProps) {
    return (
        <Form.Group className='d-flex flex-row my-2 align-items-center justify-content-start'>
            <Form.Label className='text-nowrap me-2' style={{}}>
                {props.label} :
            </Form.Label>
            {children}
        </Form.Group>
    )
}

function DirInput(props: InputProps) {
    return (
        <GenericInput {...props}>
            <Form.Control
                value={props.value as string}
                onChange={({ target }) => props.setter(target.value)}
                type='text'
            />
            <Button
                className='mx-2 text-nowrap'
                variant='outline-primary'
                onClick={() => {
                    const res = ipcRenderer.sendSync('prompt-folder')
                    if (res) props.setter(res)
                }}
            >
                <FolderSearch size={16} className='me-1' />
                Browse
            </Button>
        </GenericInput>
    )
}

function FileInput(props: InputProps) {
    return (
        <GenericInput {...props}>
            <Form.Control
                value={props.value as string}
                placeholder={props.placeholder}
                onChange={({ target }) => props.setter(target.value)}
                type='text'
            />
            <Button
                className='mx-2 text-nowrap'
                variant='outline-primary'
                onClick={() => {
                    const res = ipcRenderer.sendSync('prompt-file')
                    if (res) props.setter(res)
                }}
            >
                <FileSearch size={16} className='me-1' />
                Browse
            </Button>
        </GenericInput>
    )
}

function NumberInput(props: InputProps & { min: number; max: number }) {
    const { value, setter, min, max } = props
    return (
        <GenericInput {...props}>
            <Form.Control
                type='number'
                value={value as number}
                onChange={({ target }) =>
                    setter(
                        Math.max(
                            min,
                            Math.min(max, target.value as unknown as number)
                        )
                    )
                }
                min={min}
                max={max}
                style={{ maxWidth: '100px', marginRight: '0.5rem' }}
            />
            <Form.Range
                value={value as number}
                onChange={({ target }) => setter(target.value)}
                max={max}
                min={min}
            />
        </GenericInput>
    )
}

function TextInput(props: InputProps) {
    return (
        <GenericInput {...props}>
            <Form.Control
                className='mx-2'
                value={props.value as string}
                onChange={({ target }) => props.setter(target.value)}
                type='text'
            />
        </GenericInput>
    )
}

function BooleanInput(props: InputProps) {
    return (
        <GenericInput {...props}>
            <Form.Check
                className='mx-2 d-flex align-items-center'
                type='switch'
                checked={props.value as boolean}
                onChange={({ target }) => props.setter(target.checked)}
            />
        </GenericInput>
    )
}

function NewServerInput(props: InputProps) {
    const [value, setValue] = useState('')
    return (
        <GenericInput {...props}>
            <Form.Control
                value={value}
                placeholder={props.placeholder}
                onChange={({ target }) => setValue(target.value)}
                type='text'
            />
            <Button
                className='mx-2 text-nowrap'
                variant='outline-primary'
                onClick={() => {
                    props.setter(value)
                    setValue('')
                }}
            >
                Confirm
            </Button>
        </GenericInput>
    )
}

function ServerSelector(props: InputProps & { servers: string[] }) {
    return (
        <GenericInput {...props}>
            <Form.Select
                className='mx-2'
                value={props.value as number}
                onChange={({ target }) => props.setter(parseInt(target.value))}
            >
                {props.servers.map((server, i) => (
                    <option key={i} value={i}>
                        {server}
                    </option>
                ))}
            </Form.Select>
        </GenericInput>
    )
}
