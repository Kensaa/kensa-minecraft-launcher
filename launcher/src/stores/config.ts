import { create } from 'zustand'
import { ipcRenderer } from 'electron'
import { Config } from '../types'

interface configStore {
    rootDir: string
    ram: number
    servers: string[]
    closeLauncher: boolean
    openLogs: boolean
    showHiddenProfiles: boolean
    setRootDir: (dir: string) => void
    setRam: (ram: number) => void
    setServers: (servers: string[]) => void
    setCloseLauncher: (closeLauncher: boolean) => void
    setOpenLogs: (openLogs: boolean) => void
    setShowHiddenProfiles: (showHiddenProfiles: boolean) => void
    resetConfig: () => void
}

const store = create<configStore>(set => {
    const config = ipcRenderer.sendSync('get-config') as Config

    return {
        rootDir: config.rootDir,
        ram: config.ram,
        servers: config.servers,
        closeLauncher: config.closeLauncher,
        openLogs: config.openLogs,
        showHiddenProfiles: config.showHiddenProfiles,
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
        setOpenLogs: (openLogs: boolean) => {
            set({ openLogs })
            ipcRenderer.send('set-config', JSON.stringify({ openLogs }))
        },
        setShowHiddenProfiles: (showHiddenProfiles: boolean) => {
            set({ showHiddenProfiles })
            ipcRenderer.send(
                'set-config',
                JSON.stringify({ showHiddenProfiles })
            )
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
