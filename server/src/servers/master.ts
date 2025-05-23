// This is the code of a default server

import { ServerState, Tree } from '../types'
import fs from 'fs'
import { getHash, hashFolder, hashTree } from '../utils'
import * as tar from 'tar'
import path from 'path'

export async function sync(serverState: ServerState) {
    const { staticFolder, profilesFile } = serverState.env

    console.log('updating profiles')
    serverState.profiles = JSON.parse(fs.readFileSync(profilesFile, 'utf-8'))

    console.log('updating local hash tree')
    serverState.hashes = (await hashFolder(staticFolder)) as Tree

    console.log('recreating tarballs...')
    const tarballsFolder = path.join(staticFolder, 'tarballs')
    const gameFoldersFolder = path.join(staticFolder, 'gameFolders')
    const gameFolders = fs.readdirSync(gameFoldersFolder)

    const gameFolderHashes = serverState.hashes['gameFolders'] as Tree
    if (!gameFolderHashes) {
        console.error('missing gameFolder folder in static folder')
        process.exit(1)
    }

    const tarballsHashes = serverState.hashes['tarballs'] as Tree
    if (!tarballsHashes) {
        console.error('missing tarballs folder in static folder')
        process.exit(1)
    }

    for (const gameFolder of gameFolders) {
        const gameFolderTree = gameFolderHashes[gameFolder] as Tree
        const oldTreeHashPath = path.join(tarballsFolder, gameFolder + '.hash')
        const treeHash = hashTree(gameFolderTree)
        let oldTreeHash = ''
        if (fs.existsSync(oldTreeHashPath)) {
            oldTreeHash = fs.readFileSync(oldTreeHashPath, 'hex')
        }

        if (treeHash != oldTreeHash) {
            console.log(`${gameFolder} has changed, recreating tarball`)
            const tarballPath =
                path.join(tarballsFolder, gameFolder) + '.tar.gz'
            if (fs.existsSync(tarballPath)) {
                fs.rmSync(tarballPath)
            }
            tar.create(
                {
                    file: tarballPath,
                    gzip: true,
                    sync: true,
                    cwd: path.resolve(gameFoldersFolder)
                },
                [gameFolder]
            )

            fs.writeFileSync(oldTreeHashPath, treeHash, 'hex')

            const fileHash = await getHash(tarballPath)
            tarballsHashes[gameFolder + '.tar.gz'] = fileHash
        }
    }
}
