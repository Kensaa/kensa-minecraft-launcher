import { ipcRenderer } from 'electron'
import React, { useEffect, useState } from 'react'
import { ProgressBar } from 'react-bootstrap'

export default function GameStartingOverlay() {
    const [progress, setProgress] = useState(0)
    useEffect(() => {
        let interval = setInterval(() => {
            console.log('fetch progress')
            setProgress(ipcRenderer.sendSync('get-start-progress'))
        },1000)
        return () => clearInterval(interval)
    }, [])
    return (
        <div className=" w-100 h-100 d-flex flex-column justify-content-center align-items-center overlay user-select-none">
            <h1>The game is starting</h1>
            <h1>please wait</h1>
            <h5>{"the first launch could be very long (up to 10min (for me anyway)), so please, don't panic"}</h5>
            <div className='w-75 d-flex mt-2'>
                <ProgressBar now={progress} label={`${progress}%`} animated/>
            </div>
        </div>
    )
}
