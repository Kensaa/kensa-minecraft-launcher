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
