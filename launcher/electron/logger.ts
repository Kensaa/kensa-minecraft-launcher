import * as fs from 'fs'
import { pino, multistream } from 'pino'
import pretty from 'pino-pretty'

export function createLogger(LOG_FILE: string) {
    if (fs.existsSync(LOG_FILE)) fs.writeFileSync(LOG_FILE, '')
    const customLevels = { trace: 10, debug: 20, info: 30, game: 31 }
    const logger = pino(
        { level: 'trace', customLevels },
        multistream([
            { level: 'trace', stream: fs.createWriteStream(LOG_FILE) },
            {
                level: 'trace',
                stream: pretty({
                    customLevels,
                    //@ts-ignore
                    customColors: 'trace:gray,debug:blue,info:green,game:yellow'
                })
            }
        ])
    )
    return logger
}
