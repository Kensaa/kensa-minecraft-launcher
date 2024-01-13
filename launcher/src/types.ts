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
