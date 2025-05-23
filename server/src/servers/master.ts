// This is the code of a default server

import { ServerState, Tree } from '../types'
import fs from 'fs'
import { hashFolder } from '../utils'

export async function sync(serverState: ServerState) {
    const { staticFolder, profilesFile } = serverState.env

    serverState.profiles = JSON.parse(fs.readFileSync(profilesFile, 'utf-8'))
    serverState.hashes = (await hashFolder(staticFolder)) as Tree
}
