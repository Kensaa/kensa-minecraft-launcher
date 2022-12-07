import React, { useState, useEffect } from 'react'
import { ipcRenderer } from 'electron'
import { ProgressBar } from 'react-bootstrap'

export default function ConnectingOverlay() {
    const [progress, setProgress] = useState(0)
    useEffect(() => {
        let interval = setInterval(() => {
            console.log('fetch progress')
            setProgress(ipcRenderer.sendSync('get-login-progress'))
        },1000)
        return () => clearInterval(interval)
    }, [])
    return (
        <div className="d-flex flex-column justify-content-center align-items-center overlay user-select-none">
            <h1 style={{color:'#ffffff'}}>Connecting...</h1>
            <div className='w-75 d-flex mt-2'>
            <ProgressBar now={progress} label={`${progress}%`} animated/>
            </div>
        </div>
  )
}
