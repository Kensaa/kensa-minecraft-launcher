import express from 'express'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import 'source-map-support/register'
import { countFile } from './utils'
import type { ServerState, Tree } from './types'
import * as cloneServer from './servers/clone'
import * as masterServer from './servers/master'

const PORT = parseInt(process.env.PORT || '40069')
const STATIC_FOLDER = process.env.STATIC_FOLDER || './static'
const PROFILES_FILE = process.env.PROFILES_FILE || './profiles.json'
const SERVER_NAME =
    process.env.SERVER_NAME || crypto.randomBytes(4).toString('hex')
const MASTER_SERVER = process.env.MASTER_SERVER

const version = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8')
).version

const expectedBinaries = [
    'linux-8.tar.gz',
    'linux-17.tar.gz',
    'linux-22.tar.gz',
    'win32-8.tar.gz',
    'win32-17.tar.gz',
    'win32-22.tar.gz'
]

if (process.env.SERVER_NAME === undefined) {
    console.log(
        `SERVER_NAME environement variables is not defined, using a random name : ${SERVER_NAME}`
    )
}

if (!fs.existsSync(STATIC_FOLDER)) {
    console.error(`static folder ${STATIC_FOLDER} does not exist`)
    process.exit(1)
} else {
    const files = fs.readdirSync(STATIC_FOLDER)
    if (files.length === 0) {
        fs.mkdirSync(path.join(STATIC_FOLDER, 'forges'))
        fs.mkdirSync(path.join(STATIC_FOLDER, 'gameFolders'))
        fs.mkdirSync(path.join(STATIC_FOLDER, 'java'))
    }
}

const app = express()

const serverState: ServerState = {
    app,
    hashes: {},
    profiles: [],
    env: {
        port: PORT,
        staticFolder: STATIC_FOLDER,
        profilesFile: PROFILES_FILE,
        serverName: SERVER_NAME,
        masterServer: MASTER_SERVER
    }
}
app.use(
    cors({
        exposedHeaders: '*'
    })
)
app.use(express.json())

app.use((req, res, next) => {
    res.setHeader('X-Server-Name', serverState.env.serverName)
    next()
})

// The following endpoints are common to both servers
app.use('/static/', express.static(serverState.env.staticFolder))

app.get('/', (req, res) => {
    res.sendStatus(200)
})

app.get('/version', (req, res) => {
    res.status(200).send(version)
})

app.get('/hashes', (req, res) => {
    res.status(200).json(serverState.hashes)
})

app.get('/profiles', (req, res) => {
    res.status(200).json(serverState.profiles)
})

app.get('/fileCount/:gameFolder', (req, res) => {
    const gameFolder = req.params.gameFolder
    const gameFolderHashes = serverState.hashes['gameFolders'] as Tree
    if (!gameFolderHashes) {
        res.status(500).send('missing gameFolder folder in static folder')
        return
    }
    const tree = gameFolderHashes[gameFolder] as Tree
    if (!tree) {
        res.status(404).json({ count: 0 })
        return
    }
    const count = countFile(tree)
    res.status(200).json({ count })
})

app.listen(PORT, () => console.log(`server listening on port ${PORT}`))
;(async () => {
    if (MASTER_SERVER) {
        // IS A CLONING SERVER
        console.log('cloning server mode')

        await cloneServer.sync(serverState)
        setInterval(cloneServer.sync, 1000 * 60 * 60)
        app.post('/reload', async (req, res) => {
            await cloneServer.sync(serverState)
            res.status(200).send('reloaded')
        })
    } else {
        // IS A MASTER SERVER
        console.log('master server mode')

        const binaryFiles = fs.readdirSync(path.join(STATIC_FOLDER, 'java'))
        let missingBinaries = false
        for (const expectedBinary of expectedBinaries) {
            if (!binaryFiles.includes(expectedBinary)) {
                console.error(`missing binary ${expectedBinary}`)
                missingBinaries = true
            }
        }
        if (missingBinaries) {
            console.error(
                'note: naming convention is [platform]-[version].tar.gz'
            )
            process.exit(1)
        }
        if (!fs.existsSync(serverState.env.staticFolder)) {
            console.error(
                `profiles file ${serverState.env.staticFolder} does not exist`
            )
            process.exit(1)
        }

        await masterServer.sync(serverState)

        app.post('/reload', async (req, res) => {
            await masterServer.sync(serverState)
            res.status(200).send('reloaded')
        })
    }
})()
