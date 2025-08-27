import { ipcMain, type BrowserWindow } from 'electron'
import * as fs from 'fs'
import { pino, multistream } from 'pino'
import type { LogDescriptor } from 'pino'
import pretty from 'pino-pretty'
import { Writable } from 'stream'

let logWindow: BrowserWindow | null = null
let logsBuffer: LogDescriptor[] = []
const MAX_BUFFER = 5000

const customLevels = {
    trace: 10,
    debug: 20,
    warning: 21,
    info: 30,
    game: 31
}
const reversedCustomLevels = Object.fromEntries(
    Object.entries(customLevels).map(entry => [entry[1], entry[0]])
) as Record<number, string>
const customColors = {
    trace: 'gray',
    debug: 'blue',
    warning: 'red',
    info: 'green',
    game: 'orange'
}

ipcMain.on('get-logs-history', (event, args) => {
    event.returnValue = logsBuffer
})

export function setLogWindow(win: BrowserWindow | null) {
    logWindow = win
}

function createLogWindowStream() {
    return new Writable({
        write(chunk, _encoding, callback) {
            const line = JSON.parse(chunk.toString()) as LogDescriptor

            const levelName = reversedCustomLevels[line.level]
            const fullLine = {
                ...line,
                levelName,
                levelColor: customColors[levelName]
            }

            logsBuffer.push(fullLine)
            if (logsBuffer.length > MAX_BUFFER) {
                logsBuffer.shift()
            }

            // send new logs to the window
            if (logWindow && !logWindow.isDestroyed()) {
                logWindow.webContents.send('logs', fullLine)
            }
            callback()
        }
    })
}

export function createLogger(LOG_FILE: string) {
    if (fs.existsSync(LOG_FILE)) fs.writeFileSync(LOG_FILE, '')

    const logger = pino(
        {
            level: 'trace',
            customLevels
        },
        multistream([
            { level: 'trace', stream: pino.destination(LOG_FILE) },
            {
                level: 'trace',
                stream: pretty({
                    customLevels,
                    customColors
                })
            },
            {
                level: 'debug',
                stream: createLogWindowStream()
            }
        ])
    )
    return logger
}
