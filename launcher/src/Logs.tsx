import { ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import { useEffect, useMemo, useRef, useState } from 'react'
import { formatTime } from './utils'
import { Dropdown } from 'react-bootstrap'

const LEVELS = ['trace', 'debug', 'info', 'warning', 'game'] as const
type Level = (typeof LEVELS)[number]
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
    const scrollRef = useRef<HTMLDivElement>(null)
    const pinnedRef = useRef(true)
    const isProgrammaticScroll = useRef(false)
    const [levelFilter, setLevelFilter] = useState<Set<Level>>(new Set(LEVELS))

    const filteredLogs = useMemo(() => {
        return logs.filter(log => {
            const matchesLevel = levelFilter.has(
                log.levelName.toLowerCase() as Level
            )
            return matchesLevel
        })
    }, [logs, levelFilter])

    function toggleLevel(level: Level) {
        setLevelFilter(prev => {
            const next = new Set(prev)
            next.has(level) ? next.delete(level) : next.add(level)
            return next
        })
    }
    useEffect(() => {
        if (pinnedRef.current) {
            const el = scrollRef.current
            if (el) {
                isProgrammaticScroll.current = true
                el.scrollTop = el.scrollHeight
            }
        }
    }, [filteredLogs])

    function handleScroll(e: React.UIEvent<HTMLDivElement>) {
        if (isProgrammaticScroll.current) {
            isProgrammaticScroll.current = false
            return
        }
        const el = e.currentTarget
        const distanceFromBottom =
            el.scrollHeight - el.scrollTop - el.clientHeight
        pinnedRef.current = distanceFromBottom < 40
    }

    useEffect(() => {
        const logsListener = (_event: IpcRendererEvent, newLog: LogLine) => {
            setLogs(logs => [...logs, newLog])
        }
        ipcRenderer.on('logs', logsListener)

        return () => {
            ipcRenderer.removeListener('logs', logsListener)
        }
    }, [])

    function getToggleLabel() {
        if (levelFilter.size === LEVELS.length) return 'All levels'
        if (levelFilter.size === 0) return 'No levels'
        return [...levelFilter].map(l => l.toUpperCase()).join(', ')
    }

    return (
        <div className='logs-wrapper'>
            <div className='logs-header'>
                <Dropdown autoClose='outside'>
                    <Dropdown.Toggle variant='primary' size='sm'>
                        {getToggleLabel()}
                    </Dropdown.Toggle>
                    <Dropdown.Menu>
                        {LEVELS.map(level => (
                            <Dropdown.Item
                                key={level}
                                onClick={() => toggleLevel(level)}
                                className='d-flex align-items-center gap-2'
                            >
                                <input
                                    type='checkbox'
                                    checked={levelFilter.has(level)}
                                    onChange={() => {}}
                                />
                                {/* <span className={`text-${LEVEL_COLORS[level]}`}> */}
                                <span>{level.toUpperCase()}</span>
                            </Dropdown.Item>
                        ))}
                    </Dropdown.Menu>
                </Dropdown>
            </div>
            <div
                className='log-container'
                ref={scrollRef}
                onScroll={handleScroll}
            >
                <div>
                    {filteredLogs.map((e, i) => (
                        <Line key={i} line={e} />
                    ))}
                </div>
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
