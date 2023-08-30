import { create } from 'zustand'
import { ipcRenderer } from 'electron'

interface configStore {
    rootDir: string
    ram: number
    primaryServer: string
    cdnServer: string
    closeLauncher: boolean
    disableAutoUpdate: boolean
    setRootDir: (dir: string) => void
    setRam: (ram: number) => void
    setPrimaryServer: (primaryServer: string) => void
    setCdnServer: (cdnServer: string) => void
    setCloseLauncher: (closeLauncher: boolean) => void
    setDisableAutoUpdate: (disableAutoUpdate: boolean) => void
    resetConfig: () => void
}

export default create<configStore>(set => {
    const config = JSON.parse(ipcRenderer.sendSync('get-config'))

    return {
        rootDir: config.rootDir,
        ram: config.ram,
        primaryServer: config.primaryServer,
        cdnServer: config.cdnServer,
        closeLauncher: config.closeLauncher,
        disableAutoUpdate: config.disableAutoUpdate,
        setRootDir: (rootDir: string) => {
            set({ rootDir })
            ipcRenderer.send('set-config', JSON.stringify({ rootDir }))
        },
        setRam: (ram: number) => {
            set({ ram })
            ipcRenderer.send('set-config', JSON.stringify({ ram }))
        },
        setPrimaryServer: (primaryServer: string) => {
            if (primaryServer.endsWith('/'))
                primaryServer = primaryServer.slice(0, -1)
            set({ primaryServer })
            ipcRenderer.send('set-config', JSON.stringify({ primaryServer }))
        },
        setCdnServer: (cdnServer: string) => {
            if (cdnServer.endsWith('/')) cdnServer = cdnServer.slice(0, -1)
            set({ cdnServer })
            ipcRenderer.send('set-config', JSON.stringify({ cdnServer }))
        },
        setCloseLauncher: (closeLauncher: boolean) => {
            set({ closeLauncher })
            ipcRenderer.send('set-config', JSON.stringify({ closeLauncher }))
        },
        setDisableAutoUpdate: (disableAutoUpdate: boolean) => {
            set({ disableAutoUpdate })
            ipcRenderer.send(
                'set-config',
                JSON.stringify({ disableAutoUpdate })
            )
        },
        resetConfig: () => {
            ipcRenderer.sendSync('reset-config')
            const newConfig = JSON.parse(ipcRenderer.sendSync('get-config'))
            set({ ...newConfig })
        }
    }
})
