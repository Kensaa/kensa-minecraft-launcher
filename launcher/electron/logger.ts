import type { BrowserWindow } from 'electron'
import * as fs from 'fs'
import { pino, multistream } from 'pino'
import pretty from 'pino-pretty'
import { Writable } from 'stream'

let logWindow: BrowserWindow | null = null

export function setLogWindow(win: BrowserWindow | null) {
    logWindow = win
}

function createLogWindowStream() {
    return new Writable({
        write(chunk, _encoding, callback) {
            if (logWindow && !logWindow.isDestroyed()) {
                logWindow.webContents.send('log-line', chunk.toString())
            }
            callback()
        }
    })
}

export function createLogger(LOG_FILE: string) {
    if (fs.existsSync(LOG_FILE)) fs.writeFileSync(LOG_FILE, '')
    const customLevels = {
        trace: 10,
        debug: 20,
        warning: 21,
        info: 30,
        game: 31
    }
    const logger = pino(
        { level: 'trace', customLevels },
        multistream([
            { level: 'trace', stream: pino.destination(LOG_FILE) },
            {
                level: 'trace',
                stream: pretty({
                    customLevels,
                    customColors: {
                        trace: 'gray',
                        debug: 'blue',
                        warning: 'red',
                        info: 'green',
                        game: 'yellow'
                    }
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
