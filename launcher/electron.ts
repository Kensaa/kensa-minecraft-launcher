import { app, BrowserWindow, ipcMain, Dialog, dialog } from 'electron'
import * as path from 'path'
import * as os from 'os'
import * as fs from 'fs'
import * as msmc from 'msmc'

let win: BrowserWindow | null = null
const platorm = os.platform()
let configFolder = ''
let rootDir;

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

const defaultConfig = {
    rootDir,
    ram: 6,
    primaryServer: 'localhost',
    fallbackServer: 'localhost',

}

let loginInfo: msmc.result | null;
let config: Record<string, any> | null;

async function createWindow() {
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
    
    if(app.isPackaged){
        await win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
    }else{[
        win.loadURL("http://localhost:5173/")
    ]}

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
    } else {
        config = JSON.parse(fs.readFileSync(path.join(configFolder, 'config.json'), 'utf-8'))
    }
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
    loginInfo = null
    fs.rmSync(path.join(configFolder, 'loginInfo.json'))
})

ipcMain.on('get-config', (event, arg) => {
    event.returnValue = JSON.stringify(config)
})

ipcMain.on('set-config', (event, arg) => {
    const newConfig = JSON.parse(arg)
    config = {...config, ...newConfig}
    fs.writeFileSync(path.join(configFolder, 'config.json'), JSON.stringify(config, null, 4))
})

ipcMain.on('prompt-folder',(event, args) => {
    if(!win)return event.returnValue="error"
    const dir = dialog.showOpenDialogSync(win, {
        properties: ['openDirectory']
    })
    event.returnValue = dir
})