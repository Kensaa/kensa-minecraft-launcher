export interface Profile {
    name: string
    version: {
        mc: string
        forge?: string
    }
    gameFolder?: string
}

export type Tree = Record<string, any>
