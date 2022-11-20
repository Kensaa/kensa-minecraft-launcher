import { app, BrowserWindow, ipcMain } from 'electron'
import * as path from 'path'

let win: BrowserWindow | null = null


async function createWindow() {
    win = new BrowserWindow({
      title: 'Main window',
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      },
    })
    
    if(app.isPackaged){
        await win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
    }else{[
        win.loadURL("http://localhost:5173/")
    ]}
    win.webContents.openDevTools()
  
}

app.whenReady().then(createWindow)

ipcMain.on('test', (event, arg) => {
    event.returnValue = 'pong'
})