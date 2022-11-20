import React, { useState } from 'react'
import { Button, Dropdown, ListGroup } from 'react-bootstrap'
import authStore from './stores/auth'

import Home from './pages/Home'
import Settings from './pages/Settings'

export default function App() {
    const [connecting, setConnecting] = useState(false)
    const tabs: Record<string,JSX.Element> = 
    {
        Home : <Home/>,
        Settings: <Settings/>
    }

    const [currentTab, setCurrentTab] = useState(0)

    return (
        <div className='w-100 h-100 d-flex'>
            {connecting && 
                <div className="d-flex flex-column justify-content-center align-items-center overlay">
                    <h1>Connecting...</h1>
                    <h1>please wait</h1>
                </div>
            }
            <div className='h-100 border d-flex flex-column align-items-center' style={{width:"15%", background:"rgba(0,0,0,0.02)"}}>
                <UserVigette setConnecting={setConnecting}/>
                <Navigation tabs={tabs} currentTab={currentTab} setCurrentTab={setCurrentTab}/>

            </div>
            {tabs[Object.keys(tabs)[currentTab]]}
        </div>
    )
}

function UserVigette({setConnecting}: {setConnecting: (connecting: boolean) => void}) {
    const auth = authStore(state => ({...state}))

    const login = () => {
        setConnecting(true)
        auth.connect().then(() => setConnecting(false)) 
    }

    return(
        <div className='w-100 d-flex justify-content-center'>
            {auth.connected 
            ?<Dropdown className="w-100">
                <Dropdown.Toggle  style={{borderRadius:"0px"}} className="w-100" variant='secondary'>{auth.profile.name}</Dropdown.Toggle>
                <Dropdown.Menu className="w-100">
                    <Dropdown.Item onClick={auth.logout}>Logout</Dropdown.Item>
                </Dropdown.Menu>
            </Dropdown>
            :<>
                <Button style={{borderRadius:"0px"}} variant='secondary' className='w-100' onClick={login}>Login</Button>
            </>
            }
        </div>
    )
}

function Navigation({tabs, currentTab, setCurrentTab}: {tabs: Record<string,JSX.Element>, currentTab: number, setCurrentTab: (tab: number) => void}) {
    return (
        <div style={{flexGrow:1}} className="w-100 d-flex flex-column justify-content-center">
            <ListGroup>
                {Object.keys(tabs).map((tab, index) => {
                    return <ListGroup.Item onClick={() => setCurrentTab(index)} action variant={(index === currentTab ? 'primary' : 'secondary')} key={index}>{tab}</ListGroup.Item>
                })}
            </ListGroup>
        </div>
    )
}
