import { ipcRenderer } from 'electron'
import { FileSearch, FolderSearch } from 'lucide-react'
import React, { useState } from 'react'
import { Button, Form } from 'react-bootstrap'
import configStore from '../stores/config'

interface SettingsProps {
    hide: () => void
}

type SettingValue = string | number | boolean
type Setter = (s: SettingValue) => void

export default function Settings({ hide }: SettingsProps) {
    const config = configStore(store => ({ ...store }))

    const [rootDir, setRootDir] = useState(config.rootDir)
    const [ram, setRam] = useState(config.ram)
    const [servers, setServers] = useState(config.servers)
    const [selectedServer, setSelectedServer] = useState(config.selectedServer)
    const [cdnServer, setCdnServer] = useState(config.cdnServer)
    const [closeLauncher, setCloseLauncher] = useState(config.closeLauncher)

    const [validated, setValidated] = useState(false)

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        config.setRootDir(rootDir)
        config.setRam(ram)
        config.setCdnServer(cdnServer)
        config.setCloseLauncher(closeLauncher)
        config.setServers(servers)
        config.setSelectedServer(selectedServer)

        setValidated(true)
        hide()
    }

    const resetConfig = () => {
        hide()
        config.resetConfig()
    }

    return (
        <Form
            onSubmit={handleSubmit}
            validated={validated}
            className='w-100 h-100 d-flex flex-column p-2'
        >
            <div style={{ flexGrow: 1 }} className='w-100'>
                <DirInput
                    label='Game folder'
                    value={rootDir}
                    setter={setRootDir as Setter}
                />
                <NumberInput
                    label='RAM'
                    value={ram}
                    setter={setRam as Setter}
                    min={1}
                    max={14}
                />
                <NewServerInput
                    label='Add Server'
                    value=''
                    setter={server =>
                        setServers([...servers, server as string])
                    }
                />
                <ServerSelector
                    label='Select Server'
                    value={selectedServer}
                    setter={setSelectedServer as Setter}
                    servers={servers}
                />
                <TextInput
                    label='CDN server'
                    value={cdnServer}
                    setter={setCdnServer as Setter}
                />

                <BooleanInput
                    label='Close launcher when the game launches'
                    value={closeLauncher}
                    setter={setCloseLauncher as Setter}
                />
                <div className='d-flex justify-content-center my-1'>
                    <Button className='mx-1' onClick={resetConfig}>
                        Reset Config
                    </Button>
                </div>
            </div>
            <Button className='my-1' type='submit'>
                Save
            </Button>
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
            <Form.Label className='text-nowrap me-2'>
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
    return (
        <GenericInput {...props}>
            <label className='me-2 mb-2'>{props.value}G</label>
            <Form.Range
                className='mb-2'
                value={props.value as number}
                onChange={({ target }) => props.setter(target.value)}
                max={props.max}
                min={props.min}
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
                className='mx-2 mb-2 d-flex align-items-center'
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
