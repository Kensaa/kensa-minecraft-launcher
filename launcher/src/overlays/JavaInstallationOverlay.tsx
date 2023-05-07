import { ipcRenderer } from 'electron'
import React, { useEffect, useState } from 'react'
import { ProgressBar } from 'react-bootstrap'

export default function JavaInstallationOverlay() {
    const [progress, setProgress] = useState(0)
    useEffect(() => {
        let interval = setInterval(() => {
            setProgress(ipcRenderer.sendSync('get-java-installation-progress'))
        }, 1000)
        return () => clearInterval(interval)
    }, [])
    return (
        <div className=' w-100 h-100 d-flex flex-column justify-content-center align-items-center overlay user-select-none'>
            <h1 style={{ color: '#ffffff' }}>Java installation in progress</h1>
            <h1 style={{ color: '#ffffff' }}>please wait</h1>
            <div className='w-75 d-flex mt-2'>
                <ProgressBar now={progress} label={`${progress}%`} animated />
            </div>
        </div>
    )
}
