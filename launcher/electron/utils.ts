import * as fs from 'fs'
import * as path from 'path'
import { createHash } from 'crypto'
import fetch from 'electron-fetch'
import type { Readable } from 'stream'

export function checkExist(path: string) {
    if (!fs.existsSync(path)) {
        fs.mkdirSync(path, { recursive: true })
    }
}

export function download(
    address: string,
    filepath: string,
    headers?: Record<string, string>
) {
    return new Promise<void>(async (resolve, reject) => {
        if (!fs.existsSync(path.dirname(filepath))) {
            fs.mkdirSync(path.dirname(filepath), { recursive: true })
        }
        if (fs.existsSync(filepath)) {
            fs.writeFileSync(filepath, '')
        }
        const file = fs.createWriteStream(filepath)
        fetch(address, { headers })
            .then(res => res.body as Readable)
            .then(data => {
                data.pipe(file)
                file.on('finish', () => {
                    file.close()
                    resolve()
                })
            })
    })
}

export function getHash(src: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        const stream = fs.createReadStream(src)
        const hash = createHash('md5')
        stream.on('end', () => resolve(hash.digest('hex')))
        stream.on('error', err => reject(err))
        stream.pipe(hash)
    })
}

export async function folderTree(
    src: string
): Promise<Record<string, unknown> | string> {
    if (fs.statSync(src).isFile()) {
        return ''
    } else {
        const res: { [k: string]: Record<string, unknown> | string } = {}
        const files = fs.readdirSync(src)
        for (const file of files) {
            const filePath = path.join(src, file)
            const fileInfo = await folderTree(filePath)
            res[file] = fileInfo
        }
        return res
    }
}

export function checkServer(address: string) {
    return new Promise<boolean>((resolve, reject) => {
        fetch(address)
            .then(res => resolve(true))
            .catch(err => resolve(false))
    })
}

export async function JSONFetch(address: string) {
    return fetch(address).then(res => res.json())
}

export function copyFolder(source: string, destination: string) {
    const files = fs.readdirSync(source)
    checkExist(destination)
    for (const filename of files) {
        const filepath = path.join(source, filename)
        const fileDestination = path.join(destination, filename)
        if (fs.statSync(filepath).isFile()) {
            fs.copyFileSync(filepath, fileDestination)
        } else {
            copyFolder(filepath, fileDestination)
        }
    }
}

export function setDifference<T>(set1: Set<T>, set2: Set<T>): Set<T> {
    const result = new Set<T>()
    for (const e of set1) {
        if (!set2.has(e)) {
            result.add(e)
        }
    }
    return result
}
