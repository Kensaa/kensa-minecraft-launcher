import { ipcRenderer } from 'electron'
import React, { useState } from 'react'
import { Button, Form } from 'react-bootstrap'
import configStore from '../stores/config'

interface SettingsProps {
    hide: () => void
}

export default function Settings({ hide }: SettingsProps) {
    const config = configStore(store => ({...store}))

    const [rootDir, setRootDir] = useState(config.rootDir)
    const [ram, setRam] = useState(config.ram)
    const [primaryServer, setPrimaryServer] = useState(config.primaryServer)
    const [cdnServer, setCdnServer] = useState(config.cdnServer)
    const [jrePath, setJrePath] = useState(config.jrePath)
    const [closeLauncher, setCloseLauncher] = useState(config.closeLauncher)
    
    const [validated, setValidated] = useState(false)

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        config.setRootDir(rootDir)
        config.setRam(ram)
        config.setPrimaryServer(primaryServer)
        config.setCdnServer(cdnServer)
        config.setJrePath(jrePath)
        config.setCloseLauncher(closeLauncher)

        setValidated(true)
        hide()

    }

    return (
        <Form onSubmit={handleSubmit} validated={validated} className="w-100 h-100 d-flex flex-column p-2">
            <div style={{"flexGrow":1}} className="w-100">
                <DirInput label="Game Directory" value={rootDir} setter={(s: string | number | boolean) => setRootDir(s as string)} />
                <NumberInput label="Ram" value={ram} setter={(s: string | number | boolean) => setRam(s as number)} min={1} max={14} />
                <TextInput label="Primary Server" value={primaryServer} setter={(s: string | number | boolean) => setPrimaryServer(s as string)} />
                <TextInput label="CDN Server" value={cdnServer} setter={(s: string | number | boolean) => setCdnServer(s as string)} />
                <FileInput label="JRE executable" placeholder="leave empty if you don't know what you're doing" value={jrePath} setter={(s: string | number | boolean) => setJrePath(s as string)}/>
                <BooleanInput label="Close launcher when the game launches" value={closeLauncher} setter={(s: string | number | boolean) => setCloseLauncher(s as boolean)}/>
            </div>
            <Button type="submit">Save</Button>
        </Form>
    )
}

interface InputProps {
    label: string
    value: string | number | boolean
    placeholder?: string
    setter: (s: string | number | boolean) => void
}
function DirInput({label, value, setter}: InputProps){
    const openPrompt = () => {
        const res = ipcRenderer.sendSync('prompt-file') 
        if(res){
            setter(res)
        }
    }

    return (
        <Form.Group className="d-flex flex-row my-2 align-items-center justify-content-start">
            <Form.Label>{label}:</Form.Label>
            <Form.Control value={value as string} onChange={e => setter(e.target.value)} type="text"/>
            <Button className="mx-2" variant="outline-primary" onClick={openPrompt}>Open Folder</Button>
        </Form.Group>
    )
}

function FileInput({label, value, setter, placeholder}: InputProps){
    const openPrompt = () => {
        const res = ipcRenderer.sendSync('prompt-file') 
        if(res){
            setter(res)
        }
    }

    return (
        <Form.Group className="d-flex flex-row my-2 align-items-center justify-content-start">
            <Form.Label>{label}:</Form.Label>
            <Form.Control className="mx-2" value={value as string} placeholder={placeholder} onChange={e => setter(e.target.value)} type="text"/>
            <Button className="mx-2" variant="outline-primary" onClick={openPrompt}>Open File</Button>
        </Form.Group>
    )
}

function NumberInput({label, value, setter, min, max}: InputProps & {min:number, max:number}){
    return (
        <Form.Group className="d-flex flex-row my-2 align-items-center justify-content-start">
            <Form.Label>{label}:</Form.Label>
            <h4 style={{marginRight:'0.5rem',marginLeft:'0.5rem', color:'black'}}>{value}G</h4>

            <Form.Range value={value as number} onChange={e => setter(e.target.value)} max={max} min={min}/>
        </Form.Group>
    )
}

function TextInput({label, value, setter}: InputProps) {
    return (
        <Form.Group className="d-flex flex-row my-2 align-items-center justify-content-start">
            <Form.Label>{label}:</Form.Label>
            <Form.Control className="mx-2" value={value as string} onChange={e => setter(e.target.value)} type="text"/>
        </Form.Group>
    )
}

function BooleanInput({label, value, setter}: InputProps){
    return (
        <Form.Group className="d-flex flex-row my-2 align-items-center justify-content-start">
            <Form.Label>{label}:</Form.Label>
            <Form.Check className="mx-2" type="switch" checked={value as boolean} onChange={e => setter(e.target.checked)}/>
        </Form.Group>
    )
}