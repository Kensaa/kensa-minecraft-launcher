import { ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import { useEffect, useMemo, useState } from 'react'
import { formatTime } from './utils'

const keysToExclude = new Set([
    'hostname',
    'level',
    'msg',
    'pid',
    'time',
    'levelName',
    'levelColor'
])
type LogLine = {
    hostname: string
    level: number
    msg?: string
    pid: number
    time: number
    levelName: string
    levelColor: string
} & Record<string, any>

export default function Logs() {
    const [logs, setLogs] = useState<LogLine[]>(() =>
        ipcRenderer.sendSync('get-logs-history')
    )

    useEffect(() => {
        const logsListener = (_event: IpcRendererEvent, newLog: LogLine) => {
            setLogs(logs => [...logs, newLog])
        }
        ipcRenderer.on('logs', logsListener)

        return () => {
            ipcRenderer.removeListener('logs', logsListener)
        }
    }, [])

    return (
        <div className='log-container'>
            <div>
                {logs.map((e, i) => (
                    <Line key={i} line={e} />
                ))}
            </div>
        </div>
    )
}
interface LineProps {
    line: LogLine
}
function Line({ line }: LineProps) {
    const time = useMemo(() => formatTime(line.time), [line])
    const [lineData, hasData] = useMemo(() => {
        const res: Record<string, any> = {}
        let hasData = false
        for (const [key, val] of Object.entries(line)) {
            if (!keysToExclude.has(key)) {
                res[key] = val
                hasData = true
            }
        }
        return [res, hasData]
    }, [line])

    return (
        <div className='log-line'>
            <div>
                <span style={{ color: 'gray' }}>{time} </span>
                <span style={{ color: getColor(line.levelColor) }}>
                    {line.levelName.toUpperCase()}
                </span>
                <span>: </span>
                <span>{line.msg}</span>
            </div>
            {hasData && <div>{JSON.stringify(lineData, null, 2)}</div>}
        </div>
    )
}

// This is a bit cringe, but I can't be bothered to do it better
function getColor(color: string) {
    if (color === 'yellow') return 'orange'
    return color
}
