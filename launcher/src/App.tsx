import React, { useState } from 'react'
import { Button, Dropdown, ListGroup } from 'react-bootstrap'
import authStore from './stores/auth'

import Home from './pages/Home'
import Settings from './pages/Settings'
import UserElement from './components/UserElement'

export default function App() {
    const [overlay, setOverlay] = useState<JSX.Element | undefined>(undefined)
    const [currentTab, setCurrentTab] = useState(0)
    const tabs: Record<string,JSX.Element> = 
    {
        Home : <Home setOverlay={setOverlay}/>,
        Settings: <Settings/>
    }

    return (
        <div className='w-100 h-100 d-flex'>
            {overlay}
            <div className='h-100 d-flex flex-column align-items-center' style={{width:"15%", background:"rgba(0,0,0,0.02)", borderRight:"1px solid #dee2e6"}}>
                <UserElement setOverlay={setOverlay}/>
                <Navigation tabs={tabs} currentTab={currentTab} setCurrentTab={setCurrentTab}/>
            </div>
            {tabs[Object.keys(tabs)[currentTab]]}
        </div>
    )
}

interface NavigationProps {
    tabs: Record<string,JSX.Element>
    currentTab: number
    setCurrentTab: (tab: number) => void
}

function Navigation({tabs, currentTab, setCurrentTab}: NavigationProps) {
    return (
        <div style={{flexGrow:1}} className="w-100 d-flex flex-column justify-content-center">
            <ListGroup>
                {Object.keys(tabs).map((tab, index) => (
                    <ListGroup.Item 
                        className="user-select-none"
                        onClick={() => setCurrentTab(index)}
                        action
                        variant={(index === currentTab ? 'primary' : 'secondary')}
                        key={index}>
                    {tab}
                    </ListGroup.Item>
                ))}
            </ListGroup>
        </div>
    )
}
