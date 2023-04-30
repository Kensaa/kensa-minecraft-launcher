import { ipcRenderer } from 'electron'
import React, { useEffect, useState } from 'react'
import { ProgressBar } from 'react-bootstrap'

export default function GameStartingOverlay() {
    const [progress, setProgress] = useState(0)
    useEffect(() => {
        let interval = setInterval(() => {
            console.log('fetch progress')
            setProgress(ipcRenderer.sendSync('get-start-progress'))
        }, 1000)
        return () => clearInterval(interval)
    }, [])
    return (
        <div className=' w-100 h-100 d-flex flex-column justify-content-center align-items-center overlay user-select-none'>
            <h1 style={{ color: '#ffffff' }}>The game is starting</h1>
            <h1 style={{ color: '#ffffff' }}>please wait</h1>
            <h5 style={{ color: '#ffffff' }}>
                {'the first launch can be very long'}
            </h5>
            <div className='w-75 d-flex mt-2'>
                <ProgressBar now={progress} label={`${progress}%`} animated />
            </div>
        </div>
    )
}
