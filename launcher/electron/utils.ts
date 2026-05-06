import * as fs from 'fs'
import * as path from 'path'
import fetch from 'electron-fetch'
import { StartArgs } from '../src/types'
import https from 'https'
import http from 'http'

export function checkExist(path: string) {
    if (!fs.existsSync(path)) {
        fs.mkdirSync(path, { recursive: true })
    }
}

export async function download(
    address: string,
    filepath: string,
    headers?: Record<string, string>
): Promise<void> {
    if (!fs.existsSync(path.dirname(filepath))) {
        fs.mkdirSync(path.dirname(filepath), { recursive: true })
    }
    if (fs.existsSync(filepath)) {
        fs.writeFileSync(filepath, '')
    }
    const client = address.startsWith('https') ? https : http
    await new Promise<void>((resolve, reject) => {
        client.get(address, { headers }, res => {
            if (res.statusCode === 302) {
                // FOLLOW (returned by github when downloading releases)
                const location = res.headers.location
                if (!location) {
                    return reject(
                        new Error('Status was 302 but no Location header found')
                    )
                }
                download(location, filepath, headers)
                    .then(resolve)
                    .catch(reject)
            } else if (res.statusCode === 200) {
                const file = fs.createWriteStream(filepath)
                res.pipe(file)
                file.on('finish', () => file.close(() => resolve()))
                file.on('error', err => {
                    fs.unlinkSync(filepath)
                    reject(err)
                })
            } else {
                throw new Error(
                    `Failed to download "${address}" (${res.statusCode})`
                )
            }
        })
    })
}

export type Tree = {
    [key: string]: Tree | string
}

export async function folderTree(src: string): Promise<Tree | string> {
    if (fs.statSync(src).isFile()) {
        return ''
    } else {
        const res: Tree = {}
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

export function setDifference<T>(set1: Set<T>, set2: Set<T>): Set<T> {
    const result = new Set<T>()
    for (const e of set1) {
        if (!set2.has(e)) {
            result.add(e)
        }
    }
    return result
}

export function formatStartArgs(args: StartArgs): string {
    const profile = args.profile
    const versionArr: string[] = []
    versionArr.push(profile.version.mc)
    if (profile.version.forge) {
        versionArr.push(profile.version.forge)
    }
    let str = `${profile.name} (${versionArr.join(',')})`
    if (profile.gameFolder) {
        str += ` (folder: ${profile.gameFolder})`
    }
    str += ` from server ${args.server}`
    return str
}
