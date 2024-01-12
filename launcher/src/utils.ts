import { useEffect, useState } from 'react'
import type { Task } from './types'
import { ipcRenderer } from 'electron'

export function useFetch(address: string, options: RequestInit) {
    const [data, setData] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    useEffect(() => {
        fetch(address, options)
            .then(response => response.json())
            .then(data => {
                setData(data)
                setLoading(false)
            })
            .catch(error => {
                setError(error)
                setLoading(false)
            })
    }, [address, options])
    return { data, loading, error }
}

export function urlJoin(...args: string[]) {
    return encodeURI(
        args
            .map(e => e.replace(/\\/g, '/'))
            .join('/')
            .replace(/\/+/g, '/')
    )
}

export function useTask() {
    const [task, setTask] = useState<Task | undefined>(undefined)
    useEffect(() => {
        let interval = setInterval(() => {
            setTask(ipcRenderer.sendSync('get-current-task'))
        }, 1000)
        return () => clearInterval(interval)
    }, [])

    return task
}
