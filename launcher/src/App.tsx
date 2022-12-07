import React, { useState } from 'react'
import { ListGroup } from 'react-bootstrap'

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
            <div className='h-100 d-flex flex-column align-items-center' style={{width:"150px", background:"#1e1e1e"}}>
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
                        variant={index === currentTab ? "dark" : "secondary"}
                        action
                        key={index}>
                    {tab}
                    </ListGroup.Item>
                ))}
            </ListGroup>
        </div>
    )
}
