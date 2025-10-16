import { create } from 'zustand'
import { address } from '../config'

export type UserInfos = {
    id: number
    username: string
    is_admin: boolean
}
type AuthStore = {
    fetching: boolean
    login: (info: UserInfos) => void
    logout: () => void
} & (
    | {
          connected: false
          userInfos: undefined
      }
    | {
          connected: true
          userInfos: UserInfos
      }
)

export const useAuth = create<AuthStore>(set => {
    const fetchUserInfos = () => {
        console.log('called')
        set({ fetching: true })
        fetch(`${address}/web-api/account/me`, {
            credentials: 'include'
        })
            .then(res => {
                if (res.ok) {
                    res.json().then(userInfos =>
                        set({ connected: true, fetching: false, userInfos })
                    )
                } else {
                    set({
                        connected: false,
                        fetching: false,
                        userInfos: undefined
                    })
                }
            })
            .catch(() => {
                set({ connected: false, fetching: false, userInfos: undefined })
            })
    }

    const login = (infos: UserInfos) => {
        set({ connected: true, userInfos: infos })
    }
    const logout = () => {
        fetch(`${address}/web-api/account/logout`, {
            method: 'post',
            credentials: 'include'
        }).then(res => {
            if (res.ok) {
                set({ connected: false, userInfos: undefined })
            }
        })
    }

    fetchUserInfos()
    return {
        connected: false,
        fetching: true,
        userInfos: undefined,
        login,
        logout
    }
})
