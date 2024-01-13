import { create } from 'zustand'
import { ipcRenderer } from 'electron'

interface configStore {
    rootDir: string
    ram: number
    servers: string[]
    closeLauncher: boolean
    setRootDir: (dir: string) => void
    setRam: (ram: number) => void
    setServers: (servers: string[]) => void
    setCloseLauncher: (closeLauncher: boolean) => void
    resetConfig: () => void
}

const store = create<configStore>(set => {
    const config = ipcRenderer.sendSync('get-config')

    return {
        rootDir: config.rootDir,
        ram: config.ram,
        servers: config.servers,
        closeLauncher: config.closeLauncher,
        setRootDir: (rootDir: string) => {
            set({ rootDir })
            ipcRenderer.send('set-config', JSON.stringify({ rootDir }))
        },
        setRam: (ram: number) => {
            set({ ram })
            ipcRenderer.send('set-config', JSON.stringify({ ram }))
        },
        setServers: (servers: string[]) => {
            set({ servers })
            ipcRenderer.send('set-config', JSON.stringify({ servers }))
        },
        setCloseLauncher: (closeLauncher: boolean) => {
            set({ closeLauncher })
            ipcRenderer.send('set-config', JSON.stringify({ closeLauncher }))
        },
        resetConfig: () => {
            ipcRenderer.sendSync('reset-config')
            const newConfig = JSON.parse(ipcRenderer.sendSync('get-config'))
            set({ ...newConfig })
        }
    }
})

export const useConfig = store
export const useServers = () =>
    store(state => ({ servers: state.servers, setServers: state.setServers }))
