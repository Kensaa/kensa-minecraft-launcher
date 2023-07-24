import { create } from 'zustand'
import { ipcRenderer } from 'electron'

interface authStore {
    profile: Record<string, any>
    connected: boolean
    connect: () => Promise<boolean>
    logout: () => void
}

export default create<authStore>(set => {
    const loginInfo = JSON.parse(ipcRenderer.sendSync('msmc-result'))
    const profile = loginInfo ? loginInfo.profile : undefined

    return {
        profile,
        connected: profile ? true : false,
        connect: async () => {
            return new Promise<boolean>(resolve => {
                ipcRenderer.invoke('msmc-connect').then(res => {
                    if (res) {
                        const loginInfo = JSON.parse(
                            ipcRenderer.sendSync('msmc-result')
                        )
                        set({
                            profile: loginInfo.profile,
                            connected: loginInfo.profile ? true : false
                        })
                    }
                    resolve(res)
                })
            })
        },
        logout: () => {
            set({ profile: undefined, connected: false })
            ipcRenderer.send('msmc-logout')
        }
    }
})
