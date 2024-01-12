import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import * as path from 'path'
import * as os from 'os'
import * as fs from 'fs'
import * as msmc from 'msmc'
import { Client } from 'minecraft-launcher-core'
import { LocalStartArgs, RemoteStartArgs, StartArgs } from '../src/types'
import { createLogger } from './logger'
import decompress from 'decompress'
import { urlJoin } from './url-join'
import 'source-map-support/register'
import {
    JSONFetch,
    checkExist,
    checkServer,
    copyFolder,
    download,
    folderTree,
    getHash
} from './utils'

const launcher = new Client()

const configFolders = {
    win32: path.join('AppData', 'Roaming', 'kensa-minecraft-launcher'),
    linux: path.join('.config', 'kensa-minecraft-launcher')
}
const rootDirs = {
    win32: path.join('AppData', 'Roaming', '.kensa-launcher'),
    linux: path.join('.kensa-launcher')
}

let win: BrowserWindow | null = null
const platform = os.platform()
const supportedPlatforms = ['win32', 'linux']

let currentTask: { title: string; progress: number } | undefined = undefined
let gameStarting = false

if (!supportedPlatforms.includes(platform)) {
    console.log('unsupported platform')
    process.exit(1)
}
const configFolder = path.join(os.homedir(), configFolders[platform])
const configPath = path.join(configFolder, 'config.json')
const rootDir = path.join(os.homedir(), rootDirs[platform])

if (!fs.existsSync(configFolder)) fs.mkdirSync(configFolder)

const LOG_FILE = path.join(configFolder, 'launcher.log')
const logger = createLogger(LOG_FILE)

const defaultConfig = {
    rootDir,
    ram: 4,
    servers: [
        'http://redover.fr:40069',
        'https://mclauncher.kensa.fr',
        'http://localhost:40069'
    ],
    cdnServer: '',
    closeLauncher: true
}

let loginInfo: msmc.result | null
let config: Record<string, any>

async function createWindow() {
    logger.info('Creating Launcher Window')
    win = new BrowserWindow({
        title: 'Kensa Minecraft Launcher',
        width: 700,
        height: 700,
        autoHideMenuBar: true,
        resizable: !app.isPackaged,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    })
    logger.info('Window Created')

    const loginInfoPath = path.join(configFolder, 'loginInfo.json')
    if (fs.existsSync(loginInfoPath)) {
        loginInfo = JSON.parse(fs.readFileSync(loginInfoPath, 'utf-8'))
        if (loginInfo && loginInfo.profile) {
            if (!msmc.validate(loginInfo.profile)) {
                logger.info('login info expired, refreshing...')
                msmc.refresh(loginInfo.profile)
                    .then(res => {
                        logger.info('refreshed login info')
                        loginInfo = res
                        fs.writeFileSync(
                            loginInfoPath,
                            JSON.stringify(loginInfo, null, 4)
                        )
                    })
                    .catch(err =>
                        logger.warning('failed to refresh login info: %o', err)
                    )
            }
        } else {
            logger.warning('login info file is corrupted, deleting')
            fs.rmSync(loginInfoPath)
        }
    }

    if (!fs.existsSync(configPath)) {
        config = { ...defaultConfig }
        fs.writeFileSync(configPath, JSON.stringify(config, null, 4))
        logger.child(config).info('created config file using default config:')
    } else {
        config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
        // checking if config is missing field
        if (Object.keys(config).length !== Object.keys(defaultConfig).length) {
            logger.warning(
                'config seems to be missing some fields, resetting to default config'
            )
            config = { ...defaultConfig }
            fs.writeFileSync(configPath, JSON.stringify(config, null, 4))
        }
        logger.child(config).info('Existing config as been loaded: ')
    }
    checkExist(config.rootDir)

    if (app.isPackaged) {
        await win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
    } else {
        win.loadURL('http://localhost:5173/')
    }
}

app.whenReady().then(createWindow)
if (app.isPackaged) {
    app.on('browser-window-created', function (event, win) {
        win.setMenu(null)
    })
}

ipcMain.on('msmc-result', async (event, arg) => {
    logger.debug('msmc-result')
    const res = loginInfo ? loginInfo : {}
    event.returnValue = JSON.stringify(res)
})

ipcMain.handle('msmc-connect', (event, arg) => {
    logger.debug('msmc-connect (async)')
    return new Promise<boolean>(resolve => {
        logger.info('Connecting to Microsoft sevices...')
        currentTask = {
            title: 'Logging in',
            progress: 0
        }
        msmc.fastLaunch('electron', info => {
            if (!info.percent) return
            currentTask = {
                title: 'Logging in',
                progress: info.percent ?? 0
            }
        })
            .then(res => {
                logger.info('Connected')
                if (msmc.errorCheck(res)) {
                    resolve(false)
                } else {
                    loginInfo = res
                    fs.writeFileSync(
                        path.join(configFolder, 'loginInfo.json'),
                        JSON.stringify(loginInfo, null, 4)
                    )
                    resolve(true)
                }
            })
            .catch(err => {
                logger.error('Connection failed: %o', err)
                resolve(false)
            })
    })
})

ipcMain.on('msmc-logout', (event, arg) => {
    logger.debug('msmc-logout')
    loginInfo = null
    fs.rmSync(path.join(configFolder, 'loginInfo.json'))
})

ipcMain.handle('is-up-to-date', (event, arg) => {
    logger.debug('is-up-to-date (async)')
    return new Promise<boolean>(async (resolve, reject) => {
        const currentVersion = JSON.parse(
            fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8')
        ).version.trim()
        const latestVersion = (
            await JSONFetch(
                'https://api.github.com/repos/Kensaa/kensa-minecraft-launcher/releases/latest'
            )
        ).tag_name
            .trim()
            .substring(1)
        logger.info('Current version of Launcher: %s', currentVersion)
        logger.info('Latest available version of Launcher: %s', latestVersion)
        resolve(currentVersion == latestVersion)
    })
})

ipcMain.on('get-config', (event, arg) => {
    logger.debug('get-config')
    event.returnValue = JSON.stringify(config)
})

ipcMain.on('set-config', (event, arg) => {
    logger.debug('set-config')
    const newConfig = JSON.parse(arg)
    config = { ...config, ...newConfig }
    fs.writeFileSync(configPath, JSON.stringify(config, null, 4))
})

ipcMain.on('reset-config', (event, arg) => {
    logger.debug('reset-config')
    config = { ...defaultConfig }
    fs.writeFileSync(configPath, JSON.stringify(config, null, 4))
    event.returnValue = undefined
})

ipcMain.on('prompt-folder', (event, args) => {
    logger.debug('prompt-folder')
    if (!win) return (event.returnValue = 'error')
    const dir = dialog.showOpenDialogSync(win, {
        properties: ['openDirectory']
    })
    event.returnValue = dir ? dir[0] : undefined
})

ipcMain.on('prompt-file', (event, args) => {
    logger.debug('prompt-file')
    if (!win) return (event.returnValue = 'error')
    const dir = dialog.showOpenDialogSync(win, {
        properties: ['openFile']
    })
    event.returnValue = dir ? dir[0] : undefined
})

ipcMain.on('get-selected-profile', (event, args) => {
    logger.debug('get-selected-profile')
    if (!fs.existsSync(path.join(configFolder, 'selectedProfile.json'))) {
        event.returnValue = JSON.stringify([0, 0])
    } else {
        event.returnValue = JSON.parse(
            fs.readFileSync(
                path.join(configFolder, 'selectedProfile.json'),
                'utf-8'
            )
        ).profile
    }
})

ipcMain.on('set-selected-profile', (event, args) => {
    logger.debug('set-selected-profile')
    fs.writeFileSync(
        path.join(configFolder, 'selectedProfile.json'),
        JSON.stringify({ profile: args }, null, 4)
    )
})

ipcMain.on('get-current-task', event => {
    event.returnValue = currentTask
})

ipcMain.handle('start-game', async (_, args: StartArgs) => {
    logger.debug('start-game (async)')
    logger.info('Starting Game ...')
    return new Promise<void>(async (resolve, reject) => {
        if (gameStarting) {
            reject('game already started')
            return
        }
        gameStarting = true
        if (!config) return
        if (!loginInfo) return
        checkExist(path.join(config.rootDir, 'forgeInstallers'))
        checkExist(path.join(config.rootDir, 'profiles'))
        checkExist(path.join(config.rootDir, 'addedMods'))
        checkExist(path.join(config.rootDir, 'java'))

        currentTask = {
            title: 'Starting Game',
            progress: 0
        }

        let gameStarted = false

        launcher.on('data', e => {
            if (!gameStarted) {
                gameStarted = true
                if (config.closeLauncher) setTimeout(app.quit, 5000)
                gameStarting = false
                resolve()
            }
            // sometimes multiple lines arrive at once
            for (const s of e.trim().split('\n')) logger.game(s.trim())
        })

        launcher.on('progress', progress => {
            console.log(progress)
            const {
                type,
                task: current,
                total
            } = progress as { type: string; task: number; total: number }

            if (['assets', 'natives'].includes(type)) {
                currentTask = {
                    title: `Downloading ${type}`,
                    progress: (current / total) * 100
                }
            } else {
                currentTask = {
                    title: 'Starting Game',
                    progress: (current / total) * 100
                }
            }
        })

        try {
            if (args.type === 'remote') {
                await launchGameRemote(args)
            } else if (args.type === 'local') {
                await launchGameLocal(args)
            } else {
                reject('invalid start args')
            }
        } catch (err) {
            logger.warning(err)
            gameStarting = false
            reject(err)
        }
    })
})

async function launchGameRemote(args: RemoteStartArgs) {
    if (!config) return
    if (!loginInfo) return
    const profile = args.profile
    const primaryServer = args.server
    let downloadServer = primaryServer

    // cdn check
    if (!(await checkServer(primaryServer))) {
        // checking if server is accessible
        gameStarting = false
        throw "server is not accessible, either your config is wrong or you don't have an internet connection"
    }

    if (config.cdnServer) {
        logger.info('CDN detected in config, testing if it is working')
        if (await checkServer(config.cdnServer)) {
            logger.info('CDN working, setting it as download server')
            downloadServer = config.cdnServer
        } else {
            logger.info(
                'CDN server appear to be inaccessible, using primary server as download server'
            )
        }
    }

    logger.info('Checking if java is installed')
    const MCVersionNumber = parseInt(profile.version.mc.split('.')[1])
    const javaVersion = MCVersionNumber >= 17 ? '17' : '8'
    const javaExecutable = path.join(
        config.rootDir,
        'java',
        javaVersion,
        'bin',
        platform === 'win32' ? 'java.exe' : 'java'
    )
    await installJava(primaryServer, javaVersion)

    let forgeArgs
    if (profile.version.forge) {
        logger.info('Forge detected, downloading forge installer')
        const forgePath = path.join(
            config.rootDir,
            'forgeInstallers',
            profile.version.forge
        )
        if (!fs.existsSync(forgePath)) {
            const forgeURL = urlJoin(
                downloadServer,
                '/static/forges/',
                profile.version.forge
            )
            logger.info(`downloading ${forgeURL} to ${forgePath}`)
            await download(forgeURL, forgePath)
            logger.info(`${profile.version.forge} downloaded`)
        }
        forgeArgs = forgePath
    }
    if (profile.gameFolder) {
        logger.info('A forced game folder is detected, downloading it...')
        const localPath = path.join(
            config.rootDir,
            'profiles',
            profile.gameFolder
        )

        checkExist(localPath)

        const hashTree = await JSONFetch(urlJoin(primaryServer, 'hashes'))
        const remoteTree = hashTree['gameFolders'][profile.gameFolder]
        const fileCount: number = (
            await JSONFetch(
                urlJoin(primaryServer, 'fileCount', profile.gameFolder)
            )
        ).count

        logger.info('Remote tree fetched')
        const localTree = await folderTree(localPath)
        logger.info('Local tree created')
        function getFolders(tree: any) {
            return Object.keys(tree).filter(
                key => typeof tree[key] !== 'string'
            )
        }
        const remoteFolders = getFolders(remoteTree)
        const localFolders = getFolders(localTree)

        logger.info('Starting update procedure')
        // creates all the folder at the root that does not exists
        for (const folder of remoteFolders) {
            if (!localFolders.includes(folder)) {
                fs.mkdirSync(path.join(localPath, folder))
                localTree[folder] = {}
            }
        }

        let count = 0
        for (const folder of remoteFolders) {
            //start recursive function which will download all files for all the folders
            await downloadFolder(
                remoteTree[folder],
                localTree[folder],
                profile.gameFolder,
                localPath,
                [folder]
            )
        }
        logger.info('Update finished')
        /**
         *
         * @param remoteFolder object representing the remote folder to download (must not be the root of gameFolder, it should be the folder to download)
         * @param localFolder object representing the same folder but locally (I.E current state of the folder)
         * @param gameFolder name of the remote folder on the server
         * @param folderPath path to the local folder
         * @param pathA path to sub-folder to download (ex: ['folder1','test'] will download "gameFolder/folder1/test") (used the recreate path on disk)
         */
        async function downloadFolder(
            remoteFolder,
            localFolder,
            gameFolder: string,
            folderPath: string,
            pathA: string[] = []
        ) {
            for (const element of Object.keys(remoteFolder)) {
                const localPath = path.join(...pathA, element)
                const filepath = path.join(folderPath, localPath) // = absolute path to file
                const fileUrl = urlJoin(
                    downloadServer,
                    '/static/gameFolders',
                    gameFolder,
                    ...pathA,
                    element
                )
                if (typeof remoteFolder[element] === 'string') {
                    // Element is a file
                    if (localFolder[element] !== undefined) {
                        if (
                            (await getHash(filepath)) !== remoteFolder[element]
                        ) {
                            logger.info('Updating file "%s"', localPath)
                            await download(fileUrl, filepath)
                            count++
                            currentTask = {
                                title: 'Updating Mods',
                                progress: (count / fileCount) * 100
                            }
                        }
                    } else {
                        logger.info('Downloading file "%s"', localPath)
                        await download(fileUrl, filepath)
                        count++
                        currentTask = {
                            title: 'Updating Mods',
                            progress: (count / fileCount) * 100
                        }
                    }
                } else {
                    // Element is a folder
                    if (!localFolder[element]) {
                        fs.mkdirSync(filepath)
                        localFolder[element] = {}
                    }
                    await downloadFolder(
                        remoteFolder[element],
                        localFolder[element],
                        gameFolder,
                        folderPath,
                        pathA.concat(element)
                    )
                }
            }
            const onlyLocalFile = Object.keys(localFolder)
                .filter(key => typeof localFolder[key] === 'string')
                .filter(key => !Object.keys(remoteFolder).includes(key))
            for (const file of onlyLocalFile) {
                fs.rmSync(path.join(folderPath, ...pathA, file), {
                    recursive: true
                })
            }
        }
    } else {
        logger.info('No forced game folder detected, creating an empty one...')
        profile.gameFolder = profile.name
            .replace(/[^a-zA-Z0-9]/g, '_')
            .toLowerCase()
    }

    const gameFolder = path.join(config.rootDir, 'profiles', profile.gameFolder)

    const additionalFileFolder = path.join(
        config.rootDir,
        'additionalFiles',
        profile.gameFolder
    )
    checkExist(additionalFileFolder)
    // Copy added mods
    const additionalFiles = fs.readdirSync(additionalFileFolder)
    if (additionalFiles.length > 0) {
        checkExist(gameFolder)
        copyFolder(additionalFileFolder, gameFolder)
    }

    const opts = {
        clientPackage: null,
        authorization: msmc.getMCLC().getAuth(loginInfo),
        root: gameFolder,
        version: {
            number: profile.version.mc,
            type: 'release'
        },
        forge: forgeArgs,
        memory: {
            max: config.ram + 'G',
            min: config.ram + 'G'
        },
        javaPath: javaExecutable,
        customArgs: ['-Djava.net.preferIPv6Stack=true'],
        overrides: {
            detached: config.jrePath !== '',
            assetRoot: path.join(config.rootDir, 'assets'),
            libraryRoot: path.join(config.rootDir, 'libraries')
        }
    }
    launcher.launch(opts as any)
}

async function launchGameLocal(args: LocalStartArgs) {
    if (!config) return
    if (!loginInfo) return
    const profile = args.profile

    logger.info('Checking if java is installed')
    const MCVersionNumber = parseInt(profile.version.mc.split('.')[1])
    const javaVersion = MCVersionNumber >= 17 ? '17' : '8'
    const javaFolder = path.join(config.rootDir, 'java')
    const javaExecutable = path.join(
        javaFolder,
        javaVersion,
        'bin',
        platform === 'win32' ? 'java.exe' : 'java'
    )
    if (!fs.existsSync(javaExecutable)) {
        logger.info('Java not installed, trying to install it from server list')
        let installed = false
        for (const server of config.servers) {
            try {
                await installJava(server, javaVersion)
                installed = true
                break
            } catch {
                logger.info('Failed to install java from %s', server)
            }
        }
        if (!installed) {
            logger.info('Failed to install java from any server')
            throw 'Failed to install java from any server'
        }
    }

    let forgeArgs
    if (profile.version.forge) {
        logger.info('Forge detected, checking if forge installer is present')
        const forgePath = path.join(
            config.rootDir,
            'forgeInstallers',
            profile.version.forge
        )
        if (!fs.existsSync(forgePath)) {
            throw (
                "Forge installer isn't found, please add it to the location : " +
                forgePath
            )
        }
        forgeArgs = forgePath
    }

    profile.gameFolder = profile.gameFolder
        ? profile.gameFolder
        : profile.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()

    const gameFolder = path.join(config.rootDir, 'profiles', profile.gameFolder)

    const opts = {
        clientPackage: null,
        authorization: msmc.getMCLC().getAuth(loginInfo),
        root: gameFolder,
        version: {
            number: profile.version.mc,
            type: 'release'
        },
        forge: forgeArgs,
        memory: {
            max: config.ram + 'G',
            min: config.ram + 'G'
        },
        javaPath: javaExecutable,
        customArgs: ['-Djava.net.preferIPv6Stack=true'],
        overrides: {
            detached: config.jrePath !== '',
            assetRoot: path.join(config.rootDir, 'assets'),
            libraryRoot: path.join(config.rootDir, 'libraries')
        }
    }
    launcher.launch(opts as any)
}

async function installJava(server: string, version: string) {
    const javaFolder = path.join(config.rootDir, 'java')
    const javaExecutable = path.join(
        javaFolder,
        version,
        'bin',
        platform === 'win32' ? 'java.exe' : 'java'
    )
    if (!fs.existsSync(javaExecutable)) {
        logger.info('Java not installed, installing it...')

        const zipPath = path.join(javaFolder, 'binaries.tar.gz')
        const zipUrl = urlJoin(
            server,
            '/static/java',
            `${platform}-${version}.tar.gz`
        )
        if (!(await checkServer(zipUrl))) {
            throw 'java version not found on server'
        }
        await download(zipUrl, zipPath)
        await decompress(zipPath, path.join(javaFolder, version), {
            strip: 1
        })
        fs.rmSync(zipPath)
        logger.info('Java installed')
    }
}
