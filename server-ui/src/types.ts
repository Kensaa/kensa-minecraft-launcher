export interface Profile {
    id: number
    name: string
    version: {
        mc: string
        forge?: string
    }
    gameDirectory?: string
}
