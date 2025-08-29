import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import * as path from 'path'
import * as os from 'os'
import * as fs from 'fs'
import * as msmc from 'msmc'
import { Client, ILauncherOptions } from 'minecraft-launcher-core'
import type { StartArgs } from '../src/types'
import { createLogger, setLogWindow } from './logger'
import { fetchMcVersions } from './mcversions'
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
    getHash,
    setDifference
} from './utils'
import { totalmem } from 'os'

interface Task {
    title: string
    progress: number
}

const configFolders = {
    win32: path.join('AppData', 'Roaming', 'kensa-minecraft-launcher'),
    linux: path.join('.config', 'kensa-minecraft-launcher')
}
const rootDirs = {
    win32: path.join('AppData', 'Roaming', '.kensa-launcher'),
    linux: path.join('.kensa-launcher')
}

let win: BrowserWindow | null = null
let logWin: BrowserWindow | null = null
const platform = os.platform()
const supportedPlatforms = ['win32', 'linux']

const FOLDER_HASH_UPDATE_SKIP = ['config']

let gameStarting = false

if (!supportedPlatforms.includes(platform)) {
    dialog.showErrorBox(
        'Unsupported Platform',
        'This platform is not supported'
    )
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
    ram: 4000,
    servers: [
        'http://redover.fr:40069',
        'https://mclauncher.kensa.fr',
        'http://localhost:40069'
    ],
    closeLauncher: true,
    openLogs: false
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
        logger.info('Created config file using default config')
    } else {
        config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
        // checking if config is missing field
        const currentConfigKeys = new Set(Object.keys(config))
        const defaultConfigKeys = new Set(Object.keys(defaultConfig))
        const onlyCurrentConfigKeys = setDifference(
            currentConfigKeys,
            defaultConfigKeys
        )
        const onlyDefaultConfigKeys = setDifference(
            defaultConfigKeys,
            currentConfigKeys
        )
        if (onlyCurrentConfigKeys.size !== 0) {
            logger.warning(
                'Config: The current config contains fields that are not in the default config, removing them'
            )
            onlyCurrentConfigKeys.forEach(key => delete config[key])
            fs.writeFileSync(configPath, JSON.stringify(config, null, 4))
        }
        if (onlyDefaultConfigKeys.size !== 0) {
            logger.warning(
                'Config: The current config is missing fields that are in the default config, adding them'
            )
            onlyDefaultConfigKeys.forEach(
                key => (config[key] = defaultConfig[key])
            )
            fs.writeFileSync(configPath, JSON.stringify(config, null, 4))
        }

        // To fix old config where ram was in G
        if (config.ram <= 30) {
            logger.warning(
                'Config: The current ram amount is too small (<30) (probably because of a previous config format where ram was stored in GiB), converting it'
            )
            config.ram *= 1024 ** 2
            fs.writeFileSync(configPath, JSON.stringify(config, null, 4))
        }
    }
    logger.child(config).info('Effective config:')
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

function updateTask(task: Task | undefined) {
    if (!win) return
    win.webContents.send('task-update', task)
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
        updateTask({
            title: 'Logging in',
            progress: 0
        })
        msmc.fastLaunch('electron', info => {
            if (!info.percent) return
            updateTask({
                title: 'Logging in',
                progress: info.percent ?? 0
            })
        })
            .then(res => {
                logger.info('Connected')
                updateTask(undefined)
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

ipcMain.handle('get-update-status', (event, arg) => {
    logger.debug('get-update-status (async)')
    return new Promise(async (res, rej) => {
        const currentVersion = JSON.parse(
            fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8')
        ).version.trim()
        const latestRelease = await JSONFetch(
            'https://api.github.com/repos/Kensaa/kensa-minecraft-launcher/releases/latest'
        )

        const latestVersion = latestRelease.tag_name.substring(1)

        logger.info('Current version of Launcher: %s', currentVersion)
        logger.info('Latest version of Launcher: %s', latestVersion)

        const needsUpdate = currentVersion != latestVersion
        if (platform === 'win32') {
            res({ autoUpdate: needsUpdate, manualUpdate: false })
        } else {
            res({ autoUpdate: false, manualUpdate: needsUpdate })
        }
    })
})

ipcMain.handle('start-update', async (event, arg) => {
    logger.debug('start-update (async)')
    return new Promise(async (res, rej) => {
        const latestRelease = await JSONFetch(
            'https://api.github.com/repos/Kensaa/kensa-minecraft-launcher/releases/latest'
        )
        const version = latestRelease.name
        const installer = latestRelease.assets.find(
            asset =>
                asset.name == `Kensa-Minecraft-Launcher-Setup-${version}.exe`
        )
        if (!installer) {
            rej('no installer found')
            return
        }
        const filepath = path.join(os.tmpdir(), installer.name)
        const url = installer.url
        await download(url, filepath, {
            Accept: 'application/octet-stream'
        })

        shell.openPath(filepath)
        app.exit(0)
    })
})

ipcMain.on('get-config', (event, arg) => {
    logger.debug('get-config')
    event.returnValue = config
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
        event.returnValue = ['', 0]
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

ipcMain.on('get-local-profiles', (event, args) => {
    logger.debug('get-local-profiles')
    if (!fs.existsSync(path.join(configFolder, 'localProfiles.json'))) {
        event.returnValue = []
    } else {
        event.returnValue = JSON.parse(
            fs.readFileSync(
                path.join(configFolder, 'localProfiles.json'),
                'utf-8'
            )
        )
    }
})

ipcMain.on('set-local-profiles', (event, args) => {
    logger.debug('set-local-profiles')
    fs.writeFileSync(
        path.join(configFolder, 'localProfiles.json'),
        JSON.stringify(args, null, 4)
    )
})

ipcMain.on('get-system-ram', event => {
    logger.debug('get-system-ram')
    event.returnValue = Math.floor(totalmem() / 1024 ** 2)
})

ipcMain.handle('open-logs', async (event, args) => {
    logger.debug('open-logs')
    await openLogs()
})

ipcMain.handle('fetch-mcversions', async (event, args) => {
    logger.debug('fetch-mcversions (async)')
    return fetchMcVersions()
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

        updateTask({
            title: 'Starting Game',
            progress: 0
        })

        let gameStarted = false

        const launcher = new Client()
        const timeExp = /(\[\d\d:\d\d:\d\d\])?(.*)/
        launcher.on('data', (e: string) => {
            if (!gameStarted) {
                gameStarted = true
                updateTask(undefined)
                if (config.closeLauncher) {
                    setTimeout(app.quit, 5000)
                } else if (config.openLogs) {
                    openLogs()
                }
                gameStarting = false
                resolve()
            }
            // sometimes multiple lines arrive at once
            for (const line of e.trim().split('\n')) {
                // remove the time in front of the game logs
                const matches = line.match(timeExp)
                if (!matches) {
                    continue
                }
                const data = matches[matches.length - 1]
                logger.game(data.trim())
            }
        })

        launcher.on('progress', progress => {
            const {
                type,
                task: current,
                total
            } = progress as { type: string; task: number; total: number }

            if (['assets', 'natives'].includes(type)) {
                updateTask({
                    title: `Downloading ${type}`,
                    progress: (current / total) * 100
                })
            } else {
                updateTask({
                    title: 'Starting Game',
                    progress: (current / total) * 100
                })
            }
        })

        let launchOption: ILauncherOptions | undefined
        try {
            if (args.server === 'local') {
                launchOption = await launchGameLocal(args)
            } else if (args.server !== '') {
                launchOption = await launchGameRemote(args)
            }
        } catch (err) {
            logger.warning(err)
            gameStarting = false
            reject(err)
        }

        if (!launchOption) {
            reject('failed to start game : invalid launch option')
            return
        }
        launcher.launch(launchOption)
    })
})

async function launchGameRemote(
    args: StartArgs
): Promise<ILauncherOptions | undefined> {
    if (!config) return
    if (!loginInfo) return
    const profile = args.profile
    const primaryServer = args.server

    if (!(await checkServer(primaryServer))) {
        // checking if server is accessible
        gameStarting = false
        throw "server is not accessible, either your config is wrong or you don't have an internet connection"
    }

    logger.info('Checking if java is installed')
    logger.info('Minecraft version: %s', profile.version.mc)
    const javaVersion = getJavaVersion(profile.version.mc)
    logger.info('Java version: %s', javaVersion)
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
                primaryServer,
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

        if (!fs.existsSync(localPath)) {
            logger.info(
                'The gameFolder does not exist, so instead of downloading each file 1 by 1, we download the gameFolder compressed'
            )
            updateTask({
                title: 'Downloading Profile',
                progress: 0
            })
            fs.mkdirSync(localPath)
            const tarballFilename = profile.gameFolder + '.tar.gz'
            const tarballPath = path.join(localPath, tarballFilename)
            await download(
                urlJoin(primaryServer, 'static/tarballs', tarballFilename),
                tarballPath
            )
            updateTask({
                title: 'Downloading Profile',
                progress: 50
            })
            await decompress(tarballPath, localPath, {
                strip: 1
            })
            fs.rmSync(tarballPath)
            updateTask({
                title: 'Downloading Profile',
                progress: 100
            })
        } else {
            updateTask({
                title: 'Checking for update',
                progress: 0
            })
            const hashTree = await JSONFetch(urlJoin(primaryServer, 'hashes'))
            const remoteTree = hashTree['gameFolders'][profile.gameFolder]
            const fileCount: number = (
                await JSONFetch(
                    urlJoin(primaryServer, 'fileCount', profile.gameFolder)
                )
            ).count

            logger.info('Remote tree fetched')
            updateTask({
                title: 'Checking for update',
                progress: 50
            })
            const localTree = await folderTree(localPath)
            logger.info('Local tree created')
            function getFolders(tree: any) {
                return Object.keys(tree).filter(
                    key => typeof tree[key] !== 'string'
                )
            }
            const remoteFolders = getFolders(remoteTree)
            const localFolders = getFolders(localTree)
            updateTask({
                title: 'Checking for update',
                progress: 100
            })

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
                        primaryServer,
                        '/static/gameFolders',
                        gameFolder,
                        ...pathA,
                        element
                    )
                    if (typeof remoteFolder[element] === 'string') {
                        // Element is a file
                        if (localFolder[element] !== undefined) {
                            if (
                                pathA[0] !== undefined &&
                                FOLDER_HASH_UPDATE_SKIP.includes(pathA[0])
                            ) {
                                // Used to skip certain forlders (like config) from being updated because we don't really care about them being up to date
                                continue
                            }
                            if (
                                (await getHash(filepath)) !==
                                remoteFolder[element]
                            ) {
                                logger.info('Updating file "%s"', localPath)
                                await download(fileUrl, filepath)
                                count++
                                updateTask({
                                    title: 'Updating Profile',
                                    progress: (count / fileCount) * 100
                                })
                            }
                        } else {
                            logger.info('Downloading file "%s"', localPath)
                            await download(fileUrl, filepath)
                            count++
                            updateTask({
                                title: 'Updating Profile',
                                progress: (count / fileCount) * 100
                            })
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
                    if (
                        pathA[0] !== undefined &&
                        FOLDER_HASH_UPDATE_SKIP.includes(pathA[0])
                    ) {
                        // Used to skip certain forlders (like config) from being deleted because we don't really care about them being up to date
                        continue
                    }
                    const filepath = path.join(folderPath, ...pathA, file)
                    logger.info('Deleting file "%s"', filepath)
                    fs.rmSync(filepath, {
                        recursive: true
                    })
                }
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

    return {
        clientPackage: undefined,
        authorization: msmc.getMCLC().getAuth(loginInfo),
        root: gameFolder,
        version: {
            number: profile.version.mc,
            type: 'release'
        },
        forge: forgeArgs,
        memory: {
            max: config.ram + 'M',
            min: config.ram + 'M'
        },
        javaPath: javaExecutable,
        customArgs: ['-Djava.net.preferIPv6Stack=true'],
        overrides: {
            detached: config.jrePath !== '',
            assetRoot: path.join(config.rootDir, 'assets'),
            libraryRoot: path.join(config.rootDir, 'libraries')
        }
    }
}

async function launchGameLocal(
    args: StartArgs
): Promise<ILauncherOptions | undefined> {
    if (!config) return
    if (!loginInfo) return
    const profile = args.profile

    logger.info('Checking if java is installed')
    logger.info('Minecraft version: %s', profile.version.mc)
    const javaVersion = getJavaVersion(profile.version.mc)
    logger.info('Java version: %s', javaVersion)
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

    return {
        clientPackage: undefined,
        authorization: msmc.getMCLC().getAuth(loginInfo),
        root: gameFolder,
        version: {
            number: profile.version.mc,
            type: 'release'
        },
        forge: forgeArgs,
        memory: {
            max: config.ram + 'M',
            min: config.ram + 'M'
        },
        javaPath: javaExecutable,
        customArgs: ['-Djava.net.preferIPv6Stack=true'],
        overrides: {
            detached: true,
            assetRoot: path.join(config.rootDir, 'assets'),
            libraryRoot: path.join(config.rootDir, 'libraries')
        }
    }
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

        updateTask({
            title: 'Installing Java',
            progress: 0
        })

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
        updateTask({
            title: 'Installing Java',
            progress: 50
        })
        await decompress(zipPath, path.join(javaFolder, version), {
            strip: 1
        })
        fs.rmSync(zipPath)
        updateTask({
            title: 'Installing Java',
            progress: 100
        })
        logger.info('Java installed')
    }
}

function getJavaVersion(mcversion: string): string {
    const MCVersionNumber = parseInt(mcversion.split('.')[1])

    if (MCVersionNumber < 17) {
        return '8'
    } else if (MCVersionNumber < 21) {
        return '17'
    } else {
        return '22'
    }
}

async function openLogs() {
    if (logWin && !logWin.isDestroyed()) {
        logWin.focus()
        return
    }
    logWin = new BrowserWindow({
        title: 'Launcher Logs',
        width: 800,
        height: 500,
        autoHideMenuBar: true,
        resizable: !app.isPackaged,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    })

    if (app.isPackaged) {
        logWin.loadFile(path.join(__dirname, '..', 'dist', 'logs.html'))
    } else {
        logWin.loadURL('http://localhost:5173/logs.html')
    }
    setLogWindow(logWin)
}
