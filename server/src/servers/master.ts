// This is the code of a default server

import { ServerState, Tree } from '../types'
import fs from 'fs'
import { createArchive, getHash, hashFolder, hashTree } from '../utils'
import path from 'path'
import { tmpdir } from 'os'

export async function sync(serverState: ServerState) {
    const { staticFolder, profilesFile } = serverState.env

    console.log('updating profiles')
    serverState.profiles = JSON.parse(fs.readFileSync(profilesFile, 'utf-8'))

    console.log('updating local hash tree')
    serverState.hashes = (await hashFolder(staticFolder)) as Tree

    const tarballsFolder = path.join(staticFolder, 'tarballs')
    const curseforgeFolder = path.join(staticFolder, 'curseforgeProfiles')
    const gameFoldersFolder = path.join(staticFolder, 'gameFolders')
    const gameFolders = fs.readdirSync(gameFoldersFolder)

    const gameFolderHashes = serverState.hashes['gameFolders'] as Tree
    const tarballsHashes = serverState.hashes['tarballs'] as Tree
    const curseforgeHashes = serverState.hashes['curseforgeProfiles'] as Tree

    for (const gameFolder of gameFolders) {
        const gameFolderPath = path.join(gameFoldersFolder, gameFolder)
        if (!fs.statSync(gameFolderPath).isDirectory()) continue
        const gameFolderTree = gameFolderHashes[gameFolder] as Tree

        const gameFolderHashFile = path.join(
            gameFoldersFolder,
            gameFolder + '.hash'
        )
        const gameFolderHash = hashTree(gameFolderTree)
        let oldGameFolderHash = ''
        if (fs.existsSync(gameFolderHashFile)) {
            oldGameFolderHash = fs.readFileSync(gameFolderHashFile, 'hex')
        }

        if (gameFolderHash != oldGameFolderHash) {
            console.log(
                `${gameFolder} has changed, recreating tarball and curseforge profile`
            )
            const tarballPath = path.join(
                tarballsFolder,
                gameFolder + '.tar.gz'
            )
            await createArchive('tar', gameFolderPath, tarballPath, false)
            const tarballHash = await getHash(tarballPath)
            tarballsHashes[gameFolder + '.tar.gz'] = tarballHash
            fs.writeFileSync(gameFolderHashFile, gameFolderHash, 'hex')

            const profile = serverState.profiles.find(
                profile => profile.gameFolder === gameFolder
            )
            if (!profile) {
                console.log(
                    `couldn't find the profile associated with gamefolder ${gameFolder}, make sure that it is explicitly referenced in a profile definition`
                )
                continue
            }

            let forgeVersion: string | undefined = undefined
            if (profile.version.forge) {
                if (profile.version.forge.endsWith('.jar')) {
                    // matches every version in the forge installer name (ex: 1.2.3)
                    const reg = /(\d+.\d+.\d+)/g
                    const matches = profile.version.forge.match(reg)
                    if (!matches) {
                        console.log(
                            'could not find the forge version out of the string ' +
                                profile.version.forge
                        )
                        continue
                    }
                    // the forge version should be the last match
                    forgeVersion = matches[matches.length - 1]
                } else {
                    forgeVersion = profile.version.forge
                }
            }
            const curseforgeProfilePath = path.join(
                curseforgeFolder,
                gameFolder + '.zip'
            )

            const tmpFolder = fs.mkdtempSync(
                path.join(tmpdir(), `curseforgeProfile-${gameFolder}-`)
            )
            const overrideFolder = path.join(tmpFolder, 'overrides')
            fs.cpSync(gameFolderPath, overrideFolder, { recursive: true })
            fs.writeFileSync(
                path.join(tmpFolder, 'manifest.json'),
                JSON.stringify(
                    {
                        minecraft: {
                            version: profile.version.mc,
                            modLoaders: forgeVersion
                                ? [
                                      {
                                          id: `forge-${forgeVersion}`,
                                          primary: true
                                      }
                                  ]
                                : undefined
                        },
                        manifestType: 'minecraftModpack',
                        manifestVersion: 1,
                        name: profile.name,
                        version: '',
                        author: '',
                        files: [],
                        overrides: 'overrides'
                    },
                    null,
                    4
                )
            )

            await createArchive('zip', tmpFolder, curseforgeProfilePath, true)
            fs.rmSync(tmpFolder, { recursive: true })
            const curseforgeProfileHash = await getHash(curseforgeProfilePath)
            curseforgeHashes[gameFolder + '.zip'] = curseforgeProfileHash
        }
    }
}
