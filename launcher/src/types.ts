import type { Profile, MinecraftVersion, ForgeVersion } from 'utils'
export { Profile, MinecraftVersion, ForgeVersion }

export interface Task {
    title: string
    progress: number
}

export type StartArgs = {
    server: string
    profile: Profile
}

export interface Config {
    rootDir: string
    ram: number
    servers: string[]
    closeLauncher: boolean
    openLogs: boolean
}

export type IPCHandlerResult =
    | {
          success: false
          error: string
      }
    | {
          success: true
      }
