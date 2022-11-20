import React, { useState } from 'react'
import { Button, Dropdown, ListGroup } from 'react-bootstrap'
import authStore from './stores/auth'

import Home from './pages/Home'
import Settings from './pages/Settings'
import ConnectingOverlay from './overlays/ConnectingOverlay'

export default function App() {
    const [overlay, setOverlay] = useState<JSX.Element | undefined>(undefined)
    const [currentTab, setCurrentTab] = useState(0)
    
    const tabs: Record<string,JSX.Element> = 
    {
        Home : <Home/>,
        Settings: <Settings/>
    }

    return (
        <div className='w-100 h-100 d-flex'>
            {overlay}
            <div className='h-100 d-flex flex-column align-items-center' style={{width:"15%", background:"rgba(0,0,0,0.02)", borderRight:"1px solid #dee2e6"}}>
                <UserVigette setOverlay={setOverlay}/>
                <Navigation tabs={tabs} currentTab={currentTab} setCurrentTab={setCurrentTab}/>

            </div>
            {tabs[Object.keys(tabs)[currentTab]]}
        </div>
    )
}

function UserVigette({setOverlay}: {setOverlay: (setOverlay: JSX.Element | undefined) => void}) {
    const auth = authStore(state => ({...state}))

    const login = () => {
        setOverlay(<ConnectingOverlay/>)
        auth.connect().then(() => setOverlay(undefined)) 
    }

    return(
        <div className='w-100 d-flex justify-content-center'>
            {auth.connected 
            ?
            <Dropdown className="w-100">
                <Dropdown.Toggle  style={{borderRadius: "0px"}} className="w-100" variant='secondary'>{auth.profile.name}</Dropdown.Toggle>
                <Dropdown.Menu className="w-100">
                    <Dropdown.Item onClick={auth.logout}>Logout</Dropdown.Item>
                </Dropdown.Menu>
            </Dropdown>
            :
            <>
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
                    return <ListGroup.Item className="user-select-none" onClick={() => setCurrentTab(index)} action variant={(index === currentTab ? 'primary' : 'secondary')} key={index}>{tab}</ListGroup.Item>
                })}
            </ListGroup>
        </div>
    )
}
