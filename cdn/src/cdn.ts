import * as express from 'express'
import * as cors from 'cors'
import * as path from 'path'
import * as fs from 'fs'
import * as crypto from 'crypto'
import * as http from 'http'

const PORT = process.env.PORT || 40070
const CACHE_FOLDER = process.env.CACHE_FOLDER || './cache'

if(!fs.existsSync(CACHE_FOLDER)){
    fs.mkdirSync(CACHE_FOLDER)
}

;(() => {
    const app = express()
    app.use(cors())
    app.use(express.json())
    app.use('/static/', express.static(CACHE_FOLDER))

    app.post('/sync', async (req, res) => {
        console.log('sync called');
        const { server, } = req.body
        if(!server) return res.status(400).send('missing server field')
        console.log('primary server address : '+server);

        const remoteHashTree = await (fetch(urlJoin(server, '/hashes')).then(res => res.json())) as Tree
        const localHashTree = await hashFolder(CACHE_FOLDER) as Tree

        await compareTrees(remoteHashTree,localHashTree)
        res.sendStatus(200)

        async function compareTrees(remoteTree: Tree, localTree: Tree, pathA:string[]=[]){
            for(const element of Object.keys(remoteTree)) {
                // element is a file
                if(typeof remoteTree[element] === 'string') {
                    if(localTree[element]) {
                        if(remoteTree[element] !== localTree[element]){
                            console.log(`updating file ${element}`)
                            await download(urlJoin(server, '/static/', ...[...pathA, element]), path.join(...[CACHE_FOLDER, ...pathA, element]))
                        }
                    }else {
                        console.log(`downloading file ${element}`)
                        await download(urlJoin(server, '/static/', ...[...pathA, element]), path.join(...[CACHE_FOLDER, ...pathA, element]))
                    }
                }else{
                    // element is a folder
                    if(localTree[element]) {
                        //folder exist locally
                        await compareTrees(remoteTree[element], localTree[element], [...pathA,element])
                    }else {
                        // folder doesn't exist
                        console.log(`creating folder ${element}`)
                        fs.mkdirSync(path.join(...[CACHE_FOLDER, ...pathA, element]))
                        await compareTrees(remoteTree[element], {}, [...pathA, element])
                    }
                }
            }
            const onlyLocalFiles = Object.keys(localTree).filter(file => !Object.keys(remoteTree).includes(file))
            for(const localFile of onlyLocalFiles) {
                console.log(`deleting file ${localFile}`);
                fs.rmSync(path.join(...[CACHE_FOLDER, ...pathA, localFile]), {recursive: true})
            }

        }
    })

    app.listen(PORT, () => console.log(`server listening on port ${PORT}`))

})()

type Tree = Record<string, any>

async function hashFolder(src: string): Promise<Tree | string> {
    if(fs.statSync(src).isFile()){
        return await getHash(src)
    }
    const res: Tree = {} 
    const files = fs.readdirSync(src)
    for(const filename of files){
        const filePath = path.join(src, filename)
        const hash = await hashFolder(filePath)
        res[filename] = hash
    }
    return res
}

function getHash(src: string): Promise<string> {
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

function download(address: string, filepath: string) {
    return new Promise<void>((resolve, reject) => {
        if(fs.existsSync(path.dirname(filepath))){
            fs.mkdirSync(path.dirname(filepath), {recursive: true})
        }
        if(fs.existsSync(filepath)){
            fs.writeFileSync(filepath,'')
        }
        const file = fs.createWriteStream(filepath)
        http.get(address,res => {
            res.pipe(file)
            file.on('finish',() => {
                file.close()
                resolve()
            })
        }).on('error', err => reject(err))
    })
}