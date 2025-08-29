export interface Profile {
    name: string
    version: {
        mc: string
        forge?: string
    }
    gameFolder?: string
}

export interface Task {
    title: string
    progress: number
}

export type StartArgs = {
    server: string
    profile: Profile
}

export type Version = {
    version: string
    forgeVersions: ForgeVersion[]
}
export type ForgeVersion = {
    version: string
    latest: boolean
    recommended: boolean
}
