export interface Profile {
    name: string
    version: {
        mc: string
        forge?: string
    }
    gameFolder?: string
}
