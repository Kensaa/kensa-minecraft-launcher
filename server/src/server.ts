import * as express from 'express'
import * as cors from 'cors'
import * as path from 'path'
import * as fs from 'fs'
import * as crypto from 'crypto'
import { Request, Response, NextFunction } from 'express'

const PORT = 40069
const staticFolder = path.join(__dirname,'..', 'static')

;(async () => {
    const app = express()
    const hashTree = await hashFolder(staticFolder)

    app.use(cors())
    app.use(express.json())
    app.use('/static/', express.static(staticFolder))

    app.get('/', (req, res) => {
        res.status(200)
    })

    app.get('/hashes', (req, res) => {
        res.status(200).json(hashTree)
    })


    app.listen(PORT, () => console.log(`server listening on port ${PORT}`))

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

function getHash(src:string):Promise<string>{
    return new Promise<string>((resolve,reject) => {
        const stream = fs.createReadStream(src)
        const hash = crypto.createHash('md5')
        stream.on('end', () => resolve(hash.digest('hex')))
        stream.on('error', err => reject(err))
        stream.pipe(hash)
    })
}