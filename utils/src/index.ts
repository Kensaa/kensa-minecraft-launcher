import crypto from 'crypto'
import fs from 'fs'
export * from './mcversions'

export function hashFile(src: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        const stream = fs.createReadStream(src)
        const hash = crypto.createHash('md5')
        stream.on('end', () => resolve(hash.digest('hex')))
        stream.on('error', err => reject(err))
        stream.pipe(hash)
    })
}

export interface LegacyProfile {
    name: string
    version: {
        mc: string
        forge?: string
    }
    gameFolder?: string
}

export type Profile = LegacyProfile & {
    id: number
    gameDirectory: LegacyProfile['gameFolder']
}

export type GameDirectory = {
    name: string
}

export interface Tree<D> {
    [key: string]: Tree<D> | D
}

export interface FileTreeElement {
    hash: string
    lastModified: string
}
