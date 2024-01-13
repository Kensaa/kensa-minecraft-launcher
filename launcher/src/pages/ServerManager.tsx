import React, { useState } from 'react'
import { Button, Form, Table } from 'react-bootstrap'
import { useServers } from '../stores/config'

export default function ServerManager() {
    const [newServer, setNewServer] = useState('')
    const { servers, setServers } = useServers()
    return (
        <Table>
            <thead>
                <th>Address</th>
                <th>Action</th>
            </thead>
            <tbody>
                <tr>
                    <td className='pl-0'>
                        <Form.Control
                            value={newServer}
                            placeholder='new server'
                            onChange={({ target }) =>
                                setNewServer(target.value)
                            }
                            type='text'
                        />
                    </td>
                    <td>
                        <Button
                            variant='outline-primary'
                            disabled={
                                !new RegExp('^(http|https)://').test(newServer)
                            }
                            onClick={() => {
                                setServers([...servers, newServer])
                                setNewServer('')
                            }}
                        >
                            Confirm
                        </Button>
                    </td>
                </tr>

                {servers.map(server => (
                    <ServerComponent
                        server={server}
                        deleteServer={() => {
                            setServers(servers.filter(s => s !== server))
                        }}
                    />
                ))}
            </tbody>
        </Table>
    )
}

interface ServerComponentProps {
    server: string
    deleteServer: () => void
}

function ServerComponent({ server, deleteServer }: ServerComponentProps) {
    return (
        <tr>
            <td>{server}</td>
            <td>
                <Button variant='danger' onClick={deleteServer}>
                    Delete
                </Button>
            </td>
        </tr>
    )
}
