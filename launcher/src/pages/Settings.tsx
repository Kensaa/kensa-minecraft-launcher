import { ipcRenderer } from 'electron'
import React, { useState } from 'react'
import { Button, Form } from 'react-bootstrap'
import configStore from '../stores/config'

export default function Settings() {
    const config = configStore(store => ({...store}))

    const [rootDir, setRootDir] = useState(config.rootDir)
    const [ram, setRam] = useState(config.ram)
    const [primaryServer, setPrimaryServer] = useState(config.primaryServer)
    const [fallbackServer, setFallbackServer] = useState(config.fallbackServer)
    
    const [validated, setValidated] = useState(false)
    console.log(config)

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        config.setRootDir(rootDir)
        config.setRam(ram)
        config.setPrimaryServer(primaryServer)
        config.setFallbackServer(fallbackServer)

        setValidated(true)
        setTimeout(() => setValidated(false), 1500);
    }

    
    return (
            <Form onSubmit={handleSubmit} validated={validated} className="w-100 h-100 d-flex flex-column p-2">
                <div style={{"flexGrow":1}} className="w-100">
                    <DirInput label="Game Directory" value={rootDir} setter={(s: string | number) => setRootDir(s as string)} />
                    <NumberInput label="Game Ram" value={ram} setter={(s: string | number) => setRam(s as number)} min={6} max={14} />
                    <TextInput label="Primary Server" value={primaryServer} setter={(s: string | number) => setPrimaryServer(s as string)} />
                    <TextInput label="Fallback Server" value={fallbackServer} setter={(s: string | number) => setFallbackServer(s as string)} />

                </div>

                <Button type="submit">Save</Button>
            </Form>
    )
}

interface InputProps {
    label: string
    value: string | number
    setter: (s: string | number) => void
}
function DirInput({label, value, setter}: InputProps){
    const openPrompt = () => {
        setter(ipcRenderer.sendSync('prompt-folder'))
    }

    return (
        <Form.Group className="d-flex flex-row my-2 align-items-center">
            <Form.Label>{label}:</Form.Label>
            <Form.Control value={value} onChange={e => setter(e.target.value)} type="text"/>
            <Button className="mx-2" variant="outline-primary" onClick={openPrompt}>Open Folder</Button>
        </Form.Group>
        
    )
}

function NumberInput({label, value, setter, min, max}: InputProps & {min:number, max:number}){
    return (
        <Form.Group className="d-flex flex-row my-2 align-items-center">
            <Form.Label>{label}:</Form.Label>
            <h4 style={{marginRight:'0.5rem'}}>{value}G</h4>

            <Form.Range value={value} onChange={e => setter(e.target.value)} max={max} min={min}/>
        </Form.Group>
    )
}

function TextInput({label, value, setter}: InputProps) {
    return (
        <Form.Group className="d-flex flex-row my-2 align-items-center">
            <Form.Label>{label}:</Form.Label>
            <Form.Control value={value} onChange={e => setter(e.target.value)} type="text"/>
        </Form.Group>
    )
}