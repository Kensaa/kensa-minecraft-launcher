import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import { get as httpGet } from 'http'
import { get as httpsGet } from 'https'
import { Tree } from './types'
import type { Readable } from 'stream'

export async function hashFolder(src: string): Promise<Tree | string> {
    if (fs.statSync(src).isFile()) {
        return await getHash(src)
    }
    const res: Record<string, any> = {}
    const files = fs.readdirSync(src)
    for (const filename of files) {
        const filePath = path.join(src, filename)
        const hash = await hashFolder(filePath)
        res[filename] = hash
    }
    return res
}

export function getHash(src: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        const stream = fs.createReadStream(src)
        const hash = crypto.createHash('md5')
        stream.on('end', () => resolve(hash.digest('hex')))
        stream.on('error', err => reject(err))
        stream.pipe(hash)
    })
}

export function countFile(tree: Record<string, any> | string) {
    if (typeof tree === 'string') {
        return 1
    }
    let count = 0
    for (const key in tree) {
        count += countFile(tree[key])
    }
    return count
}

export function urlJoin(...args: string[]) {
    return encodeURI(
        args
            .map(e => e.replace(/\\/g, '/'))
            .join('/')
            .replace(/\/+/g, '/')
    )
}

export async function download(
    address: string,
    filepath: string,
    headers?: Record<string, string>
) {
    if (!fs.existsSync(path.dirname(filepath))) {
        fs.mkdirSync(path.dirname(filepath), { recursive: true })
    }
    const res = await fetch(address, { headers })

    if (!res.ok) {
        const bodyText = await res.text().catch(() => '<failed to read body>')
        throw new Error(
            `An error occurred while downloading ${address}, ` +
                `code: ${res.status} ${res.statusText}, body: ${bodyText}`
        )
    }

    const buffer = Buffer.from(await res.arrayBuffer())

    await new Promise<void>((resolve, reject) => {
        const file = fs.createWriteStream(filepath, { flags: 'w' })
        file.on('error', reject)
        file.on('finish', resolve)

        file.write(buffer)
        file.end()
    })
}

export async function fetchJson(address: string) {
    return fetch(address).then(res => res.json())
}

export function hashTree(tree: Tree): string {
    const sortedKeys = Object.keys(tree).sort((a, b) => a.localeCompare(b))

    let treeString = ''
    for (const key of sortedKeys) {
        const val = tree[key]
        if (typeof val == 'string') {
            treeString += `${key}:${val}`
        } else {
            treeString += `${key}:${hashTree(val)}`
        }
    }

    return crypto.createHash('md5').update(treeString).digest('hex')
}
