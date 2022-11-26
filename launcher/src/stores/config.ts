import create from 'zustand'
import { ipcRenderer } from 'electron'

interface configStore {
    rootDir: string
    ram: number
    primaryServer: string
    jrePath: string
    closeLauncher: boolean
    setRootDir: (dir: string) => void
    setRam: (ram: number) => void
    setPrimaryServer: (primaryServer: string) => void
    setJrePath: (jrePath: string) => void
    setCloseLauncher: (closeLauncher: boolean) => void
}

export default create<configStore>(set => {
    const config = JSON.parse(ipcRenderer.sendSync('get-config'))

    return {
        rootDir: config.rootDir,
        ram: config.ram,
        primaryServer: config.primaryServer,
        jrePath: config.jrePath,
        closeLauncher: config.closeLauncher,
        setRootDir: (rootDir: string) => {
            set({rootDir})
            ipcRenderer.send('set-config', JSON.stringify({rootDir}))
        },
        setRam: (ram: number) => {
            set({ram})
            ipcRenderer.send('set-config', JSON.stringify({ram}))
        },
        setPrimaryServer: (primaryServer: string) => {
            set({primaryServer})
            ipcRenderer.send('set-config', JSON.stringify({primaryServer}))
        },
        
        setJrePath: (jrePath: string) => {
            set({jrePath})
            ipcRenderer.send('set-config', JSON.stringify({jrePath}))
        },
        setCloseLauncher: (closeLauncher: boolean) => {
            set({closeLauncher})
            ipcRenderer.send('set-config', JSON.stringify({closeLauncher}))
        }

    }
})