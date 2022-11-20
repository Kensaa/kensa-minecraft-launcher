import create from 'zustand'
import { ipcRenderer } from 'electron'

interface configStore {
    rootDir: string
    ram: string
    setRootDir: (dir: string) => void
    setRam: (ram: string) => void
}

export default create<configStore>(set => {
    const config = JSON.parse(ipcRenderer.sendSync('get-config'))

    return {
        rootDir: config.rootDir,
        ram: config.ram,
        setRootDir: (rootDir: string) => {
            set({rootDir})
            ipcRenderer.send('set-config', {rootDir})
        },
        setRam: (ram: string) => {
            set({ram})
            ipcRenderer.send('set-config', {ram})
        }
    }
})