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

export type RemoteStartArgs = {
    type: 'remote'
    server: string
    profile: Profile
}

export type LocalStartArgs = {
    type: 'local'
    profile: Profile
}

export type StartArgs = RemoteStartArgs | LocalStartArgs
