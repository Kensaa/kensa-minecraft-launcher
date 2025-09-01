import { create } from 'zustand'
import { ipcRenderer } from 'electron'

interface authStore {
    profile: Record<string, any>
    connected: boolean
    connect: () => Promise<boolean>
    logout: () => void
}

const store = create<authStore>(set => {
    // const profile = loginInfo ? loginInfo.profile : undefined
    const fetchAuthInfo = () => {
        ipcRenderer.invoke('auth-info').then(info => {
            console.log(info)
            if (info) {
                set({ connected: true, profile: info.profile })
            } else {
                set({ connected: false, profile: undefined })
            }
        })
    }

    fetchAuthInfo()
    return {
        profile: {},
        connected: false,
        connect: async () => {
            try {
                const loginRes = await ipcRenderer.invoke('auth-login')
                console.log(loginRes)
                set({
                    profile: loginRes.profile as Record<string, any>,
                    connected: true
                })
                return true
            } catch (err) {
                set({ profile: {}, connected: false })
                return false
            }
        },
        logout: () => {
            set({ profile: undefined, connected: false })
            ipcRenderer.send('auth-logout')
        }
    }
})

export const useAuth = store
export const useIsConnected = () => store(state => state.connected)
