import type { Application } from 'express'

export interface Profile {
    name: string
    version: {
        mc: string
        forge?: string
    }
    gameFolder?: string
}

// export type Tree = Record<string, string | Tree>
export interface Tree {
    [key: string]: string | Tree
}

export interface ServerState {
    app: Application
    hashes: Tree
    profiles: Profile[]
    env: {
        port: number
        staticFolder: string
        profilesFile: string
        serverName: string
        masterServer?: string
    }
}

export type ServerSyncFunction = (serverState: ServerState) => Promise<void>
