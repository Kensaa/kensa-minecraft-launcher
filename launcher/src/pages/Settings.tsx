import { ipcRenderer } from 'electron'
import React, { useState } from 'react'
import { Button, Form } from 'react-bootstrap'
import configStore from '../stores/config'

export default function Settings() {
    const config = configStore(store => ({...store}))

    const [rootDir, setRootDir] = useState(config.rootDir)
    const [ram, setRam] = useState(config.ram)
    const [primaryServer, setPrimaryServer] = useState(config.primaryServer)
    const [fallbackServer, seFallbackServer] = useState(config.fallbackServer)
    
    const [validated, setValidated] = useState(false)

    const handleSubmit = () => {
        config.setRootDir(rootDir)
        config.setRam(ram)
        config.setPrimaryServer(primaryServer)
        config.setFallbackServer(fallbackServer)

        setValidated(true)
        setTimeout(() => setValidated(false), 1500);
        console.log('config set');
    }
    
    return (
            <Form onSubmit={handleSubmit} validated={validated} className="w-100 h-100 d-flex flex-column p-2">
                <div style={{"flexGrow":1}} className="w-100">
                    <DirInput label="Game Directory" value={rootDir} setter={(s: string | number) => setRootDir(s as string)} />
                    <DirInput label="Game Directory" value={rootDir} setter={(s: string | number) => setRootDir(s as string)} />

                </div>

                <Button type="submit">Save</Button>
                {/*} <NumberInput label="ram" value={config['ram']} setter={config['setRam']} />
                 <StringInput label="primaryServer" value={config['primaryServer']} setter={config['setPrimaryServer']} />
         <StringInput label="fallbackServer" value={config['fallbackServer']} setter={config['setFallbackServer']} />*/}
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
        <Form.Group className="d-flex flex-row my-2">
            <Form.Label>{label}:</Form.Label>
            <Form.Control value={value} onChange={e => setter(e.target.value)} type="text"/>
            <Button className="mx-2" onClick={openPrompt}>Open Folder</Button>
        </Form.Group>
        
    )
}