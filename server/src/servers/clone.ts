// This is the code of a cloning server, that replicate another server

import path from 'path'
import fs from 'fs'
import { download, fetchJson, hashFolder, urlJoin } from '../utils'
import { ServerState, Tree } from '../types'

export async function sync(serverState: ServerState) {
    const { masterServer, staticFolder } = serverState.env
    const serverHashesUrl = urlJoin(masterServer!, '/hashes')
    const serverProfilesUrl = urlJoin(masterServer!, '/profiles')

    const remoteHashTree = (await fetchJson(serverHashesUrl)) as Tree
    const localHashTree = (await hashFolder(staticFolder)) as Tree

    await compareTrees(
        masterServer!,
        staticFolder,
        remoteHashTree,
        localHashTree
    )
    serverState.hashes = remoteHashTree
    serverState.profiles = await fetchJson(serverProfilesUrl)
}

async function compareTrees(
    server: string,
    staticFolder: string,
    remoteTree: Tree,
    localTree: Tree,
    currentPath: string[] = []
) {
    const remoteFiles = Object.keys(remoteTree)
    for (const element of remoteFiles) {
        const elementPath = path.join(staticFolder, ...currentPath, element)
        const elementUrl = urlJoin(server, '/static/', ...currentPath, element)

        if (typeof remoteTree[element] === 'string') {
            // element is a file
            if (localTree[element]) {
                // file exists
                if (remoteTree[element] !== localTree[element]) {
                    // file is outdated
                    console.log(`updating file ${element}`)
                    await download(elementUrl, elementPath)
                }
            } else {
                // file doesn't exist
                console.log(`downloading file ${element}`)
                await download(elementUrl, elementPath)
            }
        } else {
            // element is a folder
            if (!localTree[element]) {
                // folder doesn't exist, creating it
                console.log(`creating folder ${element}`)
                fs.mkdirSync(elementPath)
                localTree[element] = {}
            }
            await compareTrees(
                server,
                staticFolder,
                remoteTree[element],
                localTree[element] as Tree,
                [...currentPath, element]
            )
        }
    }
    // Delete file that are not on the server
    Object.keys(localTree)
        .filter(file => !remoteFiles.includes(file))
        .forEach(localFile => {
            console.log(`deleting file ${localFile}`)
            fs.unlinkSync(path.join(staticFolder, ...currentPath, localFile))
        })
}
