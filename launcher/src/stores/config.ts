import { create } from 'zustand'
import { ipcRenderer } from 'electron'
import { Config } from '../types'

type Setter<T> = (val: T) => void
type ConfigSetters = {
    [K in keyof Config as `set${Capitalize<string & K>}`]: Setter<Config[K]>
}
type ConfigStore = Config &
    ConfigSetters & {
        resetConfig: () => void
    }

const store = create<ConfigStore>((set, get) => {
    const config = ipcRenderer.sendSync('get-config') as Config
    const configKeys = Object.keys(config) as (keyof Config)[]

    function setterFactory<K extends keyof ConfigStore>(key: K) {
        return (val: ConfigStore[K]) => {
            if (get()[key] !== val) {
                set({ [key]: val })
                ipcRenderer.send('set-config', JSON.stringify({ [key]: val }))
            }
        }
    }
    const setters = Object.fromEntries(
        configKeys.map(key => {
            return [
                `set${key[0].toUpperCase()}${key.substring(1)}`,
                setterFactory(key)
            ]
        })
    ) as ConfigSetters
    console.log(setters)
    return {
        ...config,
        ...setters,
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
