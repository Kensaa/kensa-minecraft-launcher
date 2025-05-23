// This is the code of a default server

import { ServerState, Tree } from '../types'
import fs from 'fs'
import { hashFolder } from '../utils'
import * as tar from 'tar'
import path from 'path'

export async function sync(serverState: ServerState) {
    const { staticFolder, profilesFile } = serverState.env

    console.log('updating profiles')
    serverState.profiles = JSON.parse(fs.readFileSync(profilesFile, 'utf-8'))

    console.log('recreating tarballs...')
    const tarballsFolder = path.join(staticFolder, 'tarballs')
    const gameFoldersFolder = path.join(staticFolder, 'gameFolders')

    for (const file of fs.readdirSync(tarballsFolder)) {
        fs.rmSync(path.join(tarballsFolder, file))
    }

    for (const gameFolder of fs.readdirSync(gameFoldersFolder)) {
        const gameFolderPath = path.join(gameFoldersFolder, gameFolder)
        if (!fs.statSync(gameFolderPath).isDirectory()) continue
        const tarballPath = path.join(tarballsFolder, gameFolder) + '.tar.gz'
        console.log('creating ', tarballPath)
        tar.create(
            {
                file: tarballPath,
                gzip: true,
                sync: true,
                cwd: path.resolve(gameFoldersFolder)
            },
            [gameFolder]
        )
    }

    console.log('updating local hash tree')
    serverState.hashes = (await hashFolder(staticFolder)) as Tree
}
