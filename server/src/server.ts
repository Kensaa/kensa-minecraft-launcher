import * as express from 'express'
import * as cors from 'cors'
import * as path from 'path'
import * as fs from 'fs'
import * as crypto from 'crypto'

const PORT = process.env.PORT || 40069
const ADDRESS = process.env.ADDRESS
const staticFolder = process.env.STATIC_FOLDER || './static'
const profilesFile = process.env.PROFILES_FILE || './profiles.json'
const CDNS = process.env.CDNS || ''


if(!ADDRESS){
    console.log('ADDRESS environement variables is not defined, it must be defined to your external ip address');
}

if(!staticFolder){
    console.log(`static folder not defined in environment variables`)
    process.exit(1)
}
if(!profilesFile){
    console.log(`profiles file not defined in environment variables`)
    process.exit(1)
}

if(!fs.existsSync(staticFolder)){
    console.log(`static folder ${staticFolder} does not exist`)
    process.exit(1)
}else {
    const files = fs.readdirSync(staticFolder)
    if(files.length === 0){
        fs.mkdirSync(path.join(staticFolder, 'forges'))
        fs.mkdirSync(path.join(staticFolder, 'gameFolders'))
    }
}
if(!fs.existsSync(profilesFile)){
    console.log(`profiles file ${profilesFile} does not exist`)
    process.exit(1)
}


let profiles = JSON.parse(fs.readFileSync(profilesFile,'utf-8'))

function syncCDNS(){
    CDNS.split('|').forEach(address => {
        fetch(urlJoin(address, '/sync'), {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body: JSON.stringify({
                server:`http://${ADDRESS}:${PORT}`,
            })        
        }).then(res => {
            if(res.ok){
                console.log(`cdn "${address}" is now synchronized`);
            }else {
                console.log(`cdn "${address}" sent an error while synchronizing`);
            }
        }).catch(err => {
            console.log(`cdn "${address}" can't be accessed : ${err}`);
        })
    })
}

;(async () => {
    const app = express()
    let hashTree = await hashFolder(staticFolder) as Record<string, any>

    app.use(cors())
    app.use(express.json())
    app.use('/static/', express.static(staticFolder))

    app.get('/', (req, res) => {
        res.sendStatus(200)
    })

    app.get('/hashes', (req, res) => {
        res.status(200).json(hashTree)
    })

    app.get('/profiles',(req, res) => {
        res.status(200).json(profiles)
    })

    app.post('/reload', async (req, res) => {
        hashTree = await hashFolder(staticFolder) as Record<string, any>
        profiles = JSON.parse(fs.readFileSync(profilesFile,'utf-8'))
        syncCDNS()
    })

    app.get('/fileCount/:gameFolder', (req, res) => {
        const gameFolder = req.params.gameFolder
        const gameFolderPath = path.join(staticFolder, 'gameFolders', gameFolder)
        if(!fs.existsSync(gameFolderPath)){
            res.status(404).json({count:0})
            return
        }
        if(!hashTree['gameFolders']) return res.sendStatus(500)
        const tree = hashTree['gameFolders'][gameFolder]
        const count = countFile(tree)
        res.status(200).json({count})

        function countFile(tree: Record<string, any> | string){
            if(typeof tree === 'string'){
                return 1
            }
            let count = 0
            for(const key in tree){
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
    if(fs.statSync(src).isFile()){
        return await getHash(src)
    }
    const res: Record<string, any> = {} 
    const files = fs.readdirSync(src)
    for(const filename of files){
        const filePath = path.join(src, filename)
        const hash = await hashFolder(filePath)
        res[filename] = hash
    }
    return res
}

function getHash(src: string):Promise<string> {
    return new Promise<string>((resolve,reject) => {
        const stream = fs.createReadStream(src)
        const hash = crypto.createHash('md5')
        stream.on('end', () => resolve(hash.digest('hex')))
        stream.on('error', err => reject(err))
        stream.pipe(hash)
    })
}

function urlJoin(...args: string[]) {
    return encodeURI(args.map(e=>e.replace(/\\/g,'/')).join('/').replace(/\/+/g,'/'))
}
