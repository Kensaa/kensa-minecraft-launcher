import * as express from 'express'
import * as cors from 'cors'
import * as path from 'path'
import * as fs from 'fs'
import * as crypto from 'crypto'
import 'source-map-support/register'

const PORT = parseInt(process.env.PORT || '40069')
const ADDRESS = process.env.ADDRESS
const staticFolder = process.env.STATIC_FOLDER || './static'
const profilesFile = process.env.PROFILES_FILE || './profiles.json'
const CDNS = process.env.CDNS || ''
const SERVER_NAME =
    process.env.SERVER_NAME || crypto.randomBytes(4).toString('hex')

const version = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8')
).version

const expectedBinaries = [
    'linux-8.tar.gz',
    'linux-17.tar.gz',
    'win32-8.tar.gz',
    'win32-17.tar.gz'
]

if (!ADDRESS) {
    console.log(
        'ADDRESS environement variables is not defined, it must be defined to your external ip address'
    )
}

if (process.env.SERVER_NAME === undefined) {
    console.log(
        `SERVER_NAME environement variables is not defined, using a random name : ${SERVER_NAME}`
    )
}

if (!staticFolder) {
    console.log(`static folder not defined in environment variables`)
    process.exit(1)
}
if (!profilesFile) {
    console.log(`profiles file not defined in environment variables`)
    process.exit(1)
}

if (!fs.existsSync(staticFolder)) {
    console.log(`static folder ${staticFolder} does not exist`)
    process.exit(1)
} else {
    const files = fs.readdirSync(staticFolder)
    if (files.length === 0) {
        fs.mkdirSync(path.join(staticFolder, 'forges'))
        fs.mkdirSync(path.join(staticFolder, 'gameFolders'))
        fs.mkdirSync(path.join(staticFolder, 'java'))
    }
}

const binaryFiles = fs.readdirSync(path.join(staticFolder, 'java'))
let missingBinaries = false
for (const expectedBinary of expectedBinaries) {
    if (!binaryFiles.includes(expectedBinary)) {
        console.log(`missing binary ${expectedBinary}`)
        missingBinaries = true
    }
}
if (missingBinaries) {
    console.log('note: naming convention is [platform]-[version].tar.gz')
    process.exit(1)
}

if (!fs.existsSync(profilesFile)) {
    console.log(`profiles file ${profilesFile} does not exist`)
    process.exit(1)
}

let profiles = JSON.parse(fs.readFileSync(profilesFile, 'utf-8'))

function syncCDNS() {
    if (CDNS === '') return
    CDNS.split('|').forEach(address => {
        fetch(urlJoin(address, '/sync'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                server: `http://${ADDRESS}:${PORT}`
            })
        })
            .then(res => {
                if (res.ok) {
                    console.log(`cdn "${address}" is now synchronized`)
                } else {
                    console.log(
                        `cdn "${address}" sent an error while synchronizing`
                    )
                }
            })
            .catch(err => {
                console.log(`cdn "${address}" can't be accessed : ${err}`)
            })
    })
}

;(async () => {
    const app = express()
    let hashTree = (await hashFolder(staticFolder)) as Record<string, any>

    app.use(
        cors({
            exposedHeaders: '*'
        })
    )
    app.use(express.json())
    app.use('/static/', express.static(staticFolder))

    app.use((req, res, next) => {
        // Access-Control-Request-Headers

        //res.setHeader('Access-Control-Request-Headers', '*')
        res.setHeader('X-Server-Name', SERVER_NAME)
        next()
    })

    app.get('/', (req, res) => {
        res.sendStatus(200)
    })

    app.get('/version', (req, res) => {
        res.status(200).send(version)
    })

    app.get('/hashes', (req, res) => {
        res.status(200).json(hashTree)
    })

    app.get('/profiles', (req, res) => {
        res.status(200).json(profiles)
    })

    app.post('/reload', async (req, res) => {
        hashTree = (await hashFolder(staticFolder)) as Record<string, any>
        profiles = JSON.parse(fs.readFileSync(profilesFile, 'utf-8'))
        syncCDNS()
        res.status(200).send('reloaded')
    })

    app.get('/fileCount/:gameFolder', (req, res) => {
        const gameFolder = req.params.gameFolder
        const gameFolderPath = path.join(
            staticFolder,
            'gameFolders',
            gameFolder
        )
        if (!fs.existsSync(gameFolderPath)) {
            res.status(404).json({ count: 0 })
            return
        }
        if (!hashTree['gameFolders']) return res.sendStatus(500)
        const tree = hashTree['gameFolders'][gameFolder]
        const count = countFile(tree)
        res.status(200).json({ count })

        function countFile(tree: Record<string, any> | string) {
            if (typeof tree === 'string') {
                return 1
            }
            let count = 0
            for (const key in tree) {
                count += countFile(tree[key])
            }
            return count
        }
    })

    app.listen(PORT, () => {
        console.log(`server listening on port ${PORT}`)
        syncCDNS()
    })
})()

async function hashFolder(src: string): Promise<Record<string, any> | string> {
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

function getHash(src: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        const stream = fs.createReadStream(src)
        const hash = crypto.createHash('md5')
        stream.on('end', () => resolve(hash.digest('hex')))
        stream.on('error', err => reject(err))
        stream.pipe(hash)
    })
}

function urlJoin(...args: string[]) {
    return encodeURI(
        args
            .map(e => e.replace(/\\/g, '/'))
            .join('/')
            .replace(/\/+/g, '/')
    )
}
