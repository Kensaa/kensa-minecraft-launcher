import create from 'zustand'
import { ipcRenderer } from 'electron'


interface configStore {
    rootDir: string
    ram: number
    primaryServer: string
    fallbackServer: string
    setRootDir: (dir: string) => void
    setRam: (ram: number) => void
    setPrimaryServer: (primaryServer: string) => void
    setFallbackServer: (fallbackServer: string) => void
}

export default create<configStore>(set => {
    const config = JSON.parse(ipcRenderer.sendSync('get-config'))

    return {
        rootDir: config.rootDir,
        ram: config.ram,
        primaryServer: config.primaryServer,
        fallbackServer: config.fallbackServer,
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
        setFallbackServer: (fallbackServer: string) => {
            set({fallbackServer})
            ipcRenderer.send('set-config', JSON.stringify({fallbackServer}))
        }
    }
})