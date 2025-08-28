import express from 'express'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import 'source-map-support/register'
import { countFile, download } from './utils'
import type { ServerState, ServerSyncFunction, Tree } from './types'
import * as cloneServer from './servers/clone'
import * as masterServer from './servers/master'

const PORT = parseInt(process.env.PORT || '40069')
const STATIC_FOLDER = process.env.STATIC_FOLDER || './static'
const PROFILES_FILE = process.env.PROFILES_FILE || './profiles.json'
const SERVER_NAME =
    process.env.SERVER_NAME || crypto.randomBytes(4).toString('hex')
const MASTER_SERVER = process.env.MASTER_SERVER
const GITHUB_TOKEN = process.env.GITHUB_TOKEN

const version = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8')
).version

const expectedJavaRuntimesVersion = [8, 17, 22]
const expectedJavaRuntimesPlatform = ['linux', 'win32']

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
        fs.mkdirSync(path.join(STATIC_FOLDER, 'tarballs'))
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
    let serverSyncFunction: ServerSyncFunction
    if (MASTER_SERVER) {
        // IS A CLONING SERVER
        console.log('cloning server mode')

        serverSyncFunction = cloneServer.sync
        setInterval(cloneServer.sync, 1000 * 60 * 60)
    } else {
        // IS A MASTER SERVER
        console.log('master server mode')

        const runtimeFiles = fs.readdirSync(path.join(STATIC_FOLDER, 'java'))
        for (const runtimeVersion of expectedJavaRuntimesVersion) {
            for (const runtimePlatform of expectedJavaRuntimesPlatform) {
                const runtimeFile = `${runtimePlatform}-${runtimeVersion}.tar.gz`
                if (!runtimeFiles.includes(runtimeFile)) {
                    console.log(
                        `missing runtime version ${runtimeVersion} for ${runtimePlatform}, downloading ...`
                    )
                    await downloadJavaRuntime(
                        runtimeVersion,
                        runtimePlatform,
                        path.join(STATIC_FOLDER, 'java', runtimeFile)
                    )
                    console.log(`downloaded runtime`)
                }
            }
        }
        if (!fs.existsSync(serverState.env.staticFolder)) {
            console.error(
                `profiles file ${serverState.env.staticFolder} does not exist`
            )
            process.exit(1)
        }
        serverSyncFunction = masterServer.sync
    }

    await serverSyncFunction(serverState)

    app.post('/reload', async (req, res) => {
        console.log('reloading...')
        await serverSyncFunction(serverState)
        console.log('reloaded')
        res.status(200).send('reloaded')
    })
})()

async function downloadJavaRuntime(
    version: number,
    platform: string,
    destination: string
): Promise<void> {
    const urlPlatform = platform === 'win32' ? 'windows' : platform
    const expectedExt = platform === 'win32' ? '.zip' : '.tar.gz'

    const apiURL = `https://api.github.com/repos/adoptium/temurin${version}-binaries/releases/latest`
    const requestHeaders = GITHUB_TOKEN
        ? {
              Authorization: 'Bearer ' + GITHUB_TOKEN
          }
        : undefined

    const repoData = await fetch(apiURL, { headers: requestHeaders }).then(
        res => res.json()
    )
    const assets = repoData.assets as any[]
    if (!assets) {
        console.error(
            `unable to download runtime version ${version} for platform ${platform}, please download it manually at ${destination}`
        )
        process.exit(1)
    }

    const matchingAssets = assets.filter(
        asset =>
            asset.name.includes(`jre_x64_${urlPlatform}`) &&
            asset.name.endsWith(expectedExt)
    )
    if (matchingAssets.length !== 1) {
        console.error(
            `unable to download runtime version ${version} for platform ${platform}, please download it manually at ${destination}`
        )
        process.exit(1)
    }
    const asset = matchingAssets[0]

    await download(asset.url, destination, {
        Accept: 'application/octet-stream',
        ...requestHeaders
    })
}
