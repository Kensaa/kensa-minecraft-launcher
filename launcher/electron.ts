import { app, BrowserWindow, ipcMain, ipcRenderer } from 'electron'
import * as path from 'path'
import * as os from 'os'
import * as fs from 'fs'
import * as msmc from 'msmc'

let win: BrowserWindow | null = null

const platorm = os.platform()
let configPath = ''

if(platorm === 'win32'){
    configPath = path.join(os.homedir(), 'AppData', 'Roaming', 'kensa-minecraft-launcher')
}else if(platorm === 'linux'){
    configPath = path.join(os.homedir(), '.config', 'kensa-minecraft-launcher')
}else {
    console.error('Unsupported platform')
    process.exit(1)
}

let loginInfo: msmc.result | null;

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

    if(fs.existsSync(path.join(configPath, 'loginInfo.json'))) {
        loginInfo = JSON.parse(fs.readFileSync(path.join(configPath, 'loginInfo.json'), 'utf-8'))
        if(!loginInfo)return
        if(!loginInfo.profile)return
        if(!msmc.validate(loginInfo.profile)){
            msmc.refresh(loginInfo.profile).then(res=> {
                loginInfo = res
            })
        }
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
                fs.writeFileSync(path.join(configPath, 'loginInfo.json'), JSON.stringify(loginInfo,null,4))
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
    fs.rmSync(path.join(configPath, 'loginInfo.json'))
})