import * as express from 'express'
import * as cors from 'cors'
import * as path from 'path'
import * as fs from 'fs'
import * as crypto from 'crypto'
import 'source-map-support/register'
import { countFile, download, hashFolder, urlJoin } from './utils'
import { Profile, Tree } from './types'

const PORT = parseInt(process.env.PORT || '40069')
const STATIC_FOLDER = process.env.STATIC_FOLDER || './static'
const profilesFile = process.env.PROFILES_FILE || './profiles.json'
const SERVER_NAME =
    process.env.SERVER_NAME || crypto.randomBytes(4).toString('hex')
const MASTER_SERVER = process.env.MASTER_SERVER

const version = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8')
).version

const expectedBinaries = [
    'linux-8.tar.gz',
    'linux-17.tar.gz',
    'win32-8.tar.gz',
    'win32-17.tar.gz'
]

if (process.env.SERVER_NAME === undefined) {
    console.log(
        `SERVER_NAME environement variables is not defined, using a random name : ${SERVER_NAME}`
    )
}

if (!STATIC_FOLDER) {
    console.log(`static folder not defined in environment variables`)
    process.exit(1)
}

const app = express()
let profiles: Profile[] = []
let hashes: Tree = {}

app.use(
    cors({
        exposedHeaders: '*'
    })
)
app.use(express.json())

app.use((req, res, next) => {
    res.setHeader('X-Server-Name', SERVER_NAME)
    next()
})

app.use('/static/', express.static(STATIC_FOLDER))

app.get('/', (req, res) => {
    res.sendStatus(200)
})

app.get('/version', (req, res) => {
    res.status(200).send(version)
})

app.get('/hashes', (req, res) => {
    res.status(200).json(hashes)
})

app.get('/profiles', (req, res) => {
    res.status(200).json(profiles)
})

app.get('/fileCount/:gameFolder', (req, res) => {
    const gameFolder = req.params.gameFolder
    const gameFolderPath = path.join(STATIC_FOLDER, 'gameFolders', gameFolder)
    if (!fs.existsSync(gameFolderPath)) {
        res.status(404).json({ count: 0 })
        return
    }
    if (!hashes['gameFolders']) return res.sendStatus(500)
    const tree = hashes['gameFolders'][gameFolder]
    const count = countFile(tree)
    res.status(200).json({ count })
})

app.listen(PORT, () => console.log(`server listening on port ${PORT}`))
;(async () => {
    if (MASTER_SERVER) {
        // IS A CLONING SERVER
        console.log('cloning server mode')
        async function sync() {
            console.log('starting sync')
            const remoteHashTree = (await fetch(
                urlJoin(MASTER_SERVER!, '/hashes')
            ).then(res => res.json())) as Tree
            const localHashTree = (await hashFolder(STATIC_FOLDER)) as Tree

            async function compareTrees(
                remoteTree: Tree,
                localTree: Tree,
                pathA: string[] = []
            ) {
                for (const element of Object.keys(remoteTree)) {
                    // element is a file
                    if (typeof remoteTree[element] === 'string') {
                        if (localTree[element]) {
                            if (remoteTree[element] !== localTree[element]) {
                                console.log(`updating file ${element}`)
                                await download(
                                    urlJoin(
                                        MASTER_SERVER!,
                                        '/static/',
                                        ...[...pathA, element]
                                    ),
                                    path.join(
                                        ...[STATIC_FOLDER, ...pathA, element]
                                    )
                                )
                            }
                        } else {
                            console.log(`downloading file ${element}`)
                            await download(
                                urlJoin(
                                    MASTER_SERVER!,
                                    '/static/',
                                    ...[...pathA, element]
                                ),
                                path.join(...[STATIC_FOLDER, ...pathA, element])
                            )
                        }
                    } else {
                        // element is a folder
                        if (localTree[element]) {
                            //folder exist locally
                            await compareTrees(
                                remoteTree[element],
                                localTree[element],
                                [...pathA, element]
                            )
                        } else {
                            // folder doesn't exist
                            console.log(`creating folder ${element}`)
                            fs.mkdirSync(
                                path.join(...[STATIC_FOLDER, ...pathA, element])
                            )
                            await compareTrees(remoteTree[element], {}, [
                                ...pathA,
                                element
                            ])
                        }
                    }
                }
                const onlyLocalFiles = Object.keys(localTree).filter(
                    file => !Object.keys(remoteTree).includes(file)
                )
                for (const localFile of onlyLocalFiles) {
                    console.log(`deleting file ${localFile}`)
                    fs.unlinkSync(
                        path.join(...[STATIC_FOLDER, ...pathA, localFile])
                    )
                }
            }

            await compareTrees(remoteHashTree, localHashTree)

            profiles = await fetch(urlJoin(MASTER_SERVER!, '/profiles')).then(
                res => res.json()
            )
            hashes = (await hashFolder(STATIC_FOLDER)) as Tree
            console.log('sync done')
        }
        sync()
        setInterval(sync, 1000 * 60 * 60)
        app.post('/reload', async (req, res) => {
            await sync()
            res.status(200).send('reloaded')
        })
    } else {
        // IS A MASTER SERVER
        console.log('master server mode')
        if (!profilesFile) {
            console.log(`profiles file not defined in environment variables`)
            process.exit(1)
        }

        if (!fs.existsSync(STATIC_FOLDER)) {
            console.log(`static folder ${STATIC_FOLDER} does not exist`)
            process.exit(1)
        } else {
            const files = fs.readdirSync(STATIC_FOLDER)
            if (files.length === 0) {
                fs.mkdirSync(path.join(STATIC_FOLDER, 'forges'))
                fs.mkdirSync(path.join(STATIC_FOLDER, 'gameFolders'))
                fs.mkdirSync(path.join(STATIC_FOLDER, 'java'))
            }
        }

        const binaryFiles = fs.readdirSync(path.join(STATIC_FOLDER, 'java'))
        let missingBinaries = false
        for (const expectedBinary of expectedBinaries) {
            if (!binaryFiles.includes(expectedBinary)) {
                console.log(`missing binary ${expectedBinary}`)
                missingBinaries = true
            }
        }
        if (missingBinaries) {
            console.log(
                'note: naming convention is [platform]-[version].tar.gz'
            )
            process.exit(1)
        }
        if (!fs.existsSync(profilesFile)) {
            console.log(`profiles file ${profilesFile} does not exist`)
            process.exit(1)
        }

        profiles = JSON.parse(fs.readFileSync(profilesFile, 'utf-8'))
        hashes = (await hashFolder(STATIC_FOLDER)) as Tree

        app.post('/reload', async (req, res) => {
            hashes = (await hashFolder(STATIC_FOLDER)) as Record<string, any>
            profiles = JSON.parse(fs.readFileSync(profilesFile, 'utf-8'))
            res.status(200).send('reloaded')
        })
    }
})()
