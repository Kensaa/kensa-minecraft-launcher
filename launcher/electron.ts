import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import * as path from 'path'
import * as os from 'os'
import * as fs from 'fs'
import * as msmc from 'msmc'
import { Client } from '@kensaa/minecraft-launcher-core'
import { Profile } from './src/types'
import * as http from 'http'
import * as crypto from 'crypto'

const launcher = new Client()

let win: BrowserWindow | null = null
const platorm = os.platform()
let configFolder = ''
let rootDir;
let startProgress = 0;
let loginProgress = 0;
let gameStarting = false;

if(platorm === 'win32'){
    configFolder = path.join(os.homedir(), 'AppData', 'Roaming', 'kensa-minecraft-launcher')
    rootDir = path.join(os.homedir(), 'AppData', 'Roaming', '.kensa-launcher')
}else if(platorm === 'linux'){
    configFolder = path.join(os.homedir(), '.config', 'kensa-minecraft-launcher')
    rootDir = path.join(os.homedir(), '.kensa-launcher')
}else {
    console.error('Unsupported platform')
    process.exit(1)
}

let primaryServer = 'http://redover.fr:40069'
if(app.isPackaged){
    primaryServer = 'http://localhost:40069'
}

const defaultConfig = {
    rootDir,
    ram: 6,
    primaryServer,
    jrePath: '',
    closeLauncher:true
}

let loginInfo: msmc.result | null;
let config: Record<string, any> | null;

async function createWindow() {
    console.log('createWindow')
    win = new BrowserWindow({
        title: 'Main window',
        width:1000,
        height:700,
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        }
    })
    
    if(fs.existsSync(path.join(configFolder, 'loginInfo.json'))) {
        loginInfo = JSON.parse(fs.readFileSync(path.join(configFolder, 'loginInfo.json'), 'utf-8'))
        if(!loginInfo)return
        if(!loginInfo.profile)return
        if(!msmc.validate(loginInfo.profile)){
            msmc.refresh(loginInfo.profile).then(res=> {
                loginInfo = res
            })
        }
    }
    
    if(!fs.existsSync(path.join(configFolder, 'config.json'))) {
        config = defaultConfig
        fs.writeFileSync(path.join(configFolder, 'config.json'), JSON.stringify(config, null, 4))
        console.log('created config file using default config : ')
        console.log(config)
    } else {
        config = JSON.parse(fs.readFileSync(path.join(configFolder, 'config.json'), 'utf-8'))
        console.log('parsed existing config:')
        console.log(config)
    }

    if(app.isPackaged){
        await win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
    }else{[
        win.loadURL("http://localhost:5173/")
    ]}
}

app.whenReady().then(createWindow)

ipcMain.on('msmc-result', async (event, arg) => {
    const res = loginInfo ? loginInfo : {}
    event.returnValue = JSON.stringify(res)
})

ipcMain.handle('msmc-connect', (event, arg) => {
    return new Promise<boolean>(resolve => {
        msmc.fastLaunch('electron',info => {
            console.log(info)
            if(!info.percent) return
            loginProgress = info.percent
        }).then(res => {
            console.log('connected')
            if (msmc.errorCheck(res)){
                resolve(false)
            }else{
                loginInfo = res
                fs.writeFileSync(path.join(configFolder, 'loginInfo.json'), JSON.stringify(loginInfo,null,4))
                resolve(true)
            }
        }).catch(res => {
            console.log('connection failed')
            resolve(false)
        })
    })
})

ipcMain.on('msmc-logout', (event, arg) => {
    console.log('msmc-logout')
    loginInfo = null
    fs.rmSync(path.join(configFolder, 'loginInfo.json'))
})

ipcMain.on('get-config', (event, arg) => {
    console.log('get-config')
    event.returnValue = JSON.stringify(config)
})

ipcMain.on('set-config', (event, arg) => {
    console.log('set-config')
    const newConfig = JSON.parse(arg)
    config = {...config, ...newConfig}
    fs.writeFileSync(path.join(configFolder, 'config.json'), JSON.stringify(config, null, 4))
})

ipcMain.on('prompt-folder',(event, args) => {
    if(!win)return event.returnValue="error"
    const dir = dialog.showOpenDialogSync(win, {
        properties: ['openDirectory']
    })
    if(dir){
        event.returnValue = dir[0]
    }else{
        event.returnValue = undefined
    }
})

ipcMain.on('prompt-file',(event, args) => {
    if(!win)return event.returnValue="error"
    const dir = dialog.showOpenDialogSync(win, {
        properties: ['openFile']
    })
    if(dir){
        event.returnValue = dir[0]
    }else { 
        event.returnValue = undefined
    }
})

ipcMain.handle('start-game', async (event, args: Profile) => {
    return new Promise<void>(async (resolve,reject) => {
        if(gameStarting) {
            reject('game already started')
            return
        }
        gameStarting = true
        console.log(config)
        if(!config) return
        if(!loginInfo) return
        checkExist(config.rootDir)
        checkExist(path.join(config.rootDir, 'forgeInstallers'))
        checkExist(path.join(config.rootDir, 'profiles'))
        let forgeArgs
        if(args.version.forge){
            console.log('forge detected, downloading')
            await download(urlJoin(config.primaryServer,'/static/forges/',args.version.forge), path.join(config.rootDir, 'forgeInstallers', args.version.forge))
            console.log('downloaded')
            forgeArgs = path.join(config.rootDir, 'forgeInstallers', args.version.forge)
        }
    
        if(args.gameFolder){
            console.log('game folder detected, downloading')
            const localPath = path.join(config.rootDir, 'profiles', args.gameFolder)
            checkExist(localPath)
            console.log('created folder')
    
            const hashTree = await fetch(urlJoin(config.primaryServer, '/hashes')) as any
            console.log('hashTree');
            console.log(hashTree);
            const remoteTree = hashTree['gameFolders'][args.gameFolder]
            console.log('remote tree fetched')
            let localTree = await folderTree(localPath)
            console.log('local tree created')
            const remoteFolders = Object.keys(remoteTree).filter(key => typeof remoteTree[key] !== 'string')
            const localFolders = Object.keys(localTree).filter(key => typeof localTree[key] !== 'string')
    
            console.log('starting update procedure')
            for(const folder of remoteFolders){
                if(!localFolders.includes(folder)){
                    fs.mkdirSync(path.join(localPath, folder))
                }
            }
            localTree = await folderTree(localPath)
    
            for(const folder of remoteFolders){
                const remoteFiles = Object.keys(remoteTree[folder])
                let i = 0
                for(const file of remoteFiles){
                    if(!Object.keys(localTree[folder]).includes(file)){
                        console.log('downloading file: ' + path.join(folder, file))
                        await download(urlJoin(config.primaryServer, '/static/gameFolders', args.gameFolder, folder, file), path.join(localPath, folder, file))
                    }else{
                        if(await getHash(path.join(localPath, folder, file)) !== remoteTree[folder][file]){
                            console.log('updating file: ' + path.join(folder, file))
                            await download(urlJoin(config.primaryServer, '/static/gameFolders', args.gameFolder, folder, file), path.join(localPath, folder, file))
                        }
                    }
                    startProgress = i / remoteFiles.length * 100
                    i++
                }
                const onlyLocalFiles = Object.keys(localTree[folder]).filter(file => !Object.keys(remoteTree[folder]).includes(file))
                for(const file of onlyLocalFiles){
                    console.log('deleting file: ' + path.join(folder, file))
                    fs.rmSync(path.join(localPath, folder, file))
                }
            }
    
        }else {
            console.log('no game folder detected creating an empty one')
            args.gameFolder = args.name.replace(/[^a-zA-Z0-9]/g,'_').toLowerCase()
        }
        
        let opts = {
            clientPackage: null,
            authorization: msmc.getMCLC().getAuth(loginInfo),
            root: config.rootDir,
            version: {
                number: args.version.mc,
                type: "release"
            },
            forge: forgeArgs,
            memory: {
                max: config.ram+"G",
                min: "1G"
            },
            javaPath: (config.jrePath !== ''? config.jrePath : undefined),
            overrides: {
                gameDirectory: path.join(config.rootDir, 'profiles', args.gameFolder)
            }
        }
    
        console.log(opts)
        launcher.launch(opts as any)
        launcher.on('debug', e => console.log(e))
        launcher.on('data', e => console.log(e))
        launcher.on('start', e => {
            if(!config) return
            if(config.closeLauncher) app.quit()
            gameStarting = false
            resolve()
        })
        launcher.on('progress', progress => {
            if(typeof progress !== 'number') return
            console.log("progress: "+progress+"%")
            startProgress = progress
        })
    })
})

ipcMain.on('get-start-progress', (event, arg) => {
    event.returnValue = startProgress
})

ipcMain.on('get-login-progress', (event, arg) => {
    event.returnValue = loginProgress
})

function checkExist(path: string){
    console.log(path);
    if(!fs.existsSync(path)){
        fs.mkdirSync(path)
    }
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
        http.get(address,res=>{
            res.pipe(file)
            file.on('finish',()=>{
                file.close()
                resolve()
            })
        }).on('error',(err)=>reject(err))
    })
}

function urlJoin(...args: string[]) {
    return encodeURI(args.map(e=>e.replace(/\\/g,'/')).join('/').replace(/\/+/g,'/'))
}

function getHash(src:string):Promise<string>{
    return new Promise<string>((resolve,reject)=>{
        const stream = fs.createReadStream(src)
        const hash = crypto.createHash('md5')
        stream.on('end',()=>resolve(hash.digest('hex')))
        stream.on('error',(err)=>reject(err))
        stream.pipe(hash)
    })
    
}

async function folderTree(src: string): Promise<Record<string, unknown> | string> {
    if (fs.statSync(src).isFile()) {
        return ''
    } else {
        const res: {[k: string]: Record<string, unknown> | string} = {}
        const files = fs.readdirSync(src)
        for (const file of files) {
            const filePath = path.join(src, file)
            const fileInfo = await folderTree(filePath)
            res[file] = fileInfo
        }
        return res
    }
}

function fetch(address){
    return new Promise((resolve, reject)=>{
        http.get(address, res=>{
            let data = ''
            res.on('data', chunk => data += chunk)
            res.on('end', () => resolve(JSON.parse(data)))
        }).on('error', err => reject(err))
    })
}