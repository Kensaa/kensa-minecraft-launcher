import { useEffect, useState } from 'react'
import { ipcRenderer } from 'electron'
import type { Task } from '../types'
import { ProgressBar } from 'react-bootstrap'

export default function TaskProgressBar() {
    const [task, setTask] = useState<Task | undefined>(undefined)

    useEffect(() => {
        ipcRenderer.on('task-update', (_, task) => {
            console.log(task)
            setTask(task)
        })
    }, [])

    if (!task) return
    return (
        <ProgressBar
            variant='success'
            style={{ position: 'absolute', bottom: 0, borderRadius: 0 }}
            now={task.progress}
            label={task.title}
        />
    )
}
