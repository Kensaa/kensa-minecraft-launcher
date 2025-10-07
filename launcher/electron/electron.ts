import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import * as path from 'path'
import * as os from 'os'
import * as fs from 'fs'
import { Auth, Xbox } from 'msmc'
import { Client, ILauncherOptions, IUser } from 'minecraft-launcher-core'
import type { StartArgs } from '../src/types'
import { createLogger, setLogWindow } from './logger'
import { fetchMcVersions } from './mcversions'
import decompress from 'decompress'
import { urlJoin } from './url-join'
import 'source-map-support/register'
import {
    JSONFetch,
    Tree,
    checkExist,
    checkServer,
    download,
    folderTree,
    formatStartArgs,
    getHash,
    setDifference
} from './utils'
import { totalmem } from 'os'
import semver from 'semver'
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
const authInfoPath = path.join(configFolder, 'authInfo.json')

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

const authInstance = new Auth('select_account')
let authInfo: Xbox | undefined
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

    if (fs.existsSync(authInfoPath)) {
        logger.info('loading auth infos')
        try {
            authInfo = await authInstance.refresh(
                fs.readFileSync(authInfoPath, 'utf-8')
            )
            fs.writeFileSync(authInfoPath, authInfo.save(), 'utf-8')
            logger.info('loaded auth infos')
        } catch (err) {
            logger.warning('failed to load auth infos: %s', err)
            fs.rmSync(authInfoPath)
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

ipcMain.handle('auth-info', async (event, args) => {
    logger.debug('auth-info (async)')
    if (authInfo) {
        return await authInfo.getMinecraft()
    }
})

ipcMain.handle('auth-login', async (event, arg) => {
    logger.debug('msmc-connect (async)')
    updateTask({
        title: 'Logging in',
        progress: 0
    })
    try {
        const res = await authInstance.launch('electron')
        updateTask({
            title: 'Logging in',
            progress: 50
        })
        authInfo = res
        fs.writeFileSync(authInfoPath, res.save(), 'utf-8')
        const minecraftInfo = await authInfo.getMinecraft()
        updateTask(undefined)
        return minecraftInfo
    } catch (err) {
        logger.child(err as object).warning('failed to login:')
        updateTask(undefined)
        throw err
    }
})

ipcMain.on('auth-logout', (event, arg) => {
    logger.debug('auth-logout')
    authInfo = undefined
    fs.rmSync(authInfoPath)
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
        let localProfiles = JSON.parse(
            fs.readFileSync(
                path.join(configFolder, 'localProfiles.json'),
                'utf-8'
            )
        )

        // Migration from forge installer to forge version
        for (const profile of localProfiles) {
            if (
                profile.version.forge &&
                profile.version.forge.endsWith('.jar')
            ) {
                // profile still is a file
                const reg = /forge-.*-(.*)-installer.jar/
                const matches = profile.version.forge.match(reg)
                if (matches) {
                    const forgeVersion = matches[matches.length - 1]
                    logger.debug(
                        `forge migration: inferred forge version ${forgeVersion} from file ${profile.version.forge} for profile ${profile.name}`
                    )
                    profile.version.forge = forgeVersion
                } else {
                }
            }
        }

        event.returnValue = localProfiles
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
    if (gameStarting) {
        throw new Error('game already starting')
    }
    gameStarting = true
    if (!config) throw new Error('no config loaded')
    if (!authInfo) throw new Error('not logged in')
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
            return
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

    try {
        const launchOptions = await launchGame(args)
        launcher.launch(launchOptions)
    } catch (err) {
        logger.warning(err)
        gameStarting = false
        throw err
    }
})

async function launchGame(args: StartArgs): Promise<ILauncherOptions> {
    const profile = args.profile
    logger.info('launching the game with args : %s', formatStartArgs(args))
    const server = args.server !== 'local' ? args.server : undefined

    // if the profile is remote, check for server availability
    if (server) {
        if (!(await checkServer(server))) {
            throw new Error(
                "server is not accessible, either your config is wrong or you don't have an internet connection"
            )
        }
    }

    const javaVersion = getJavaVersion(profile.version.mc)
    logger.info('Checking if java %s is installed', javaVersion)
    const javaPath = path.join(
        config.rootDir,
        'java',
        javaVersion,
        'bin',
        platform === 'win32' ? 'java.exe' : 'java'
    )

    // Two cases
    if (server) {
        // remote profile => download from server
        await installJava(server, javaVersion)
    } else {
        // local profile => try to download from any server
        let installed = false
        for (const server of config.servers) {
            try {
                await installJava(server, javaVersion)
                installed = true
                break
            } catch {}
        }
        if (!installed) {
            throw new Error('Failed to install java from any server')
        }
    }

    let forgePath: string | undefined
    if (profile.version.forge) {
        // if forge is specified
        // two cases (as before) (even if the server will only be used in case of a legacy forge download)
        if (server) {
            forgePath = await downloadForge(
                profile.version.mc,
                profile.version.forge,
                server
            )
        } else {
            let installed = false
            for (const server of config.servers) {
                try {
                    forgePath = await downloadForge(
                        profile.version.mc,
                        profile.version.forge,
                        server
                    )
                    installed = true
                } catch {}
            }

            if (!installed) {
                throw new Error('Failed to download forge from any server')
            }
        }
    }

    // gamefolder handling
    // if remote and specified=> download/update
    // if remote and not specified => create
    // if local => create
    if (server && profile.gameFolder) {
        logger.info('A forced game folder is detected, checking for updates...')
        const gameFolderPath = path.join(
            config.rootDir,
            'profiles',
            profile.gameFolder
        )

        if (!fs.existsSync(gameFolderPath)) {
            logger.info(
                "The gamefolder doesn't exist, downloading a compressed version"
            )
            updateTask({
                title: 'Downloading Profile',
                progress: 0
            })
            fs.mkdirSync(gameFolderPath)
            const tarballFilename = profile.gameFolder + '.tar.gz'
            const tarballPath = path.join(gameFolderPath, tarballFilename)
            await download(
                urlJoin(server, 'static/tarballs', tarballFilename),
                tarballPath
            )
            updateTask({
                title: 'Downloading Profile',
                progress: 50
            })
            await decompress(tarballPath, gameFolderPath, {
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
            const hashTree = await JSONFetch(urlJoin(server, 'hashes'))
            const remoteTree = hashTree['gameFolders'][
                profile.gameFolder
            ] as Tree
            const fileCount: number = (
                await JSONFetch(
                    urlJoin(server, 'fileCount', profile.gameFolder)
                )
            ).count

            logger.info('Remote tree fetched')
            updateTask({
                title: 'Checking for update',
                progress: 50
            })
            const localTree = (await folderTree(gameFolderPath)) as Tree
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
                    fs.mkdirSync(path.join(gameFolderPath, folder))
                    localTree[folder] = {}
                }
            }

            for (const folder of remoteFolders) {
                //start recursive function which will download all files for all the folders
                await downloadFolder(
                    server,
                    remoteTree[folder] as Tree,
                    localTree[folder] as Tree,
                    profile.gameFolder,
                    gameFolderPath,
                    [folder],
                    fileCount
                )
            }
            logger.info('Update finished')
        }
    } else {
        if (!profile.gameFolder) {
            logger.info(
                'No forced game folder detected, creating an empty one...'
            )
            profile.gameFolder = profile.name
                .replace(/[^a-zA-Z0-9]/g, '_')
                .toLowerCase()
        } else {
            logger.info(
                'A forced game folder is detected, but profile is local, skipping update'
            )
        }
    }

    const gameFolderPath = path.join(
        config.rootDir,
        'profiles',
        profile.gameFolder
    )

    // handle additional files
    logger.info('Copying additional files')
    const additionalFileFolder = path.join(
        config.rootDir,
        'additionalFiles',
        profile.gameFolder
    )
    checkExist(additionalFileFolder)
    const additionalFiles = fs.readdirSync(additionalFileFolder)
    if (additionalFiles.length > 0) {
        checkExist(gameFolderPath)
        fs.cpSync(additionalFileFolder, gameFolderPath, { recursive: true })
    }

    await refreshAuth()
    const auth = await authInfo?.getMinecraft()
    if (!auth) throw new Error('failed to get Minecraft auth info')
    return {
        clientPackage: undefined,
        authorization: auth.mclc(true) as IUser,
        root: gameFolderPath,
        version: {
            number: profile.version.mc,
            type: 'release'
        },
        forge: forgePath,
        memory: {
            max: config.ram + 'M',
            min: config.ram + 'M'
        },
        javaPath: javaPath,
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

/**
 * Downloads forge for a given version
 * If the forge version given as argument is a file (ex: forge-1.20.1-47.3.0-installer.jar), it will use the legacy way of downloading (downloading for the server given as 3rd param), else it will download the version from forge's servers
 * @param mcVersion the version of Minecraft
 * @param forgeVersion the version of Forge
 * @param server the server to download from if using legacy way of downloading
 * @returns the path to the downloaded file
 */
async function downloadForge(
    mcVersion: string,
    forgeVersion: string,
    server?: string
): Promise<string> {
    // Check for old forge format (directly the forge installer)
    if (forgeVersion.endsWith('.jar')) {
        // LEGACY WAY OF DOWNLOADING FOR (FROM THE SERVER)
        logger.info('Forge legacy mode (downloading from launcher server)')
        const forgePath = path.join(
            config.rootDir,
            'forgeInstallers',
            forgeVersion
        )
        if (!fs.existsSync(forgePath)) {
            if (!server) {
                throw new Error(
                    'Not able to download this version of forge: ' +
                        forgeVersion +
                        'please change the profile to the new forge version format'
                )
            }
            const forgeURL = urlJoin(server, '/static/forges/', forgeVersion)
            logger.info(`downloading ${forgeURL} to ${forgePath}`)
            await download(forgeURL, forgePath)
            logger.info(`${forgeVersion} downloaded`)
        }
        return forgePath
    } else {
        // NEW WAY : DOWNLOAD THE INSTALLER DIRECTLY
        logger.info(
            'Forge new mode (downloading directly from forge repository)'
        )
        // The launcher library says that for version below 1.13, the "universal" jar is needed, and for 1.13+, the "installer" jar is needed
        const semverMcVersion = semver.coerce(mcVersion)
        if (!semverMcVersion) {
            throw `the following minecraft version is not supported for forge: ${mcVersion}`
        }
        const fileType = semver.satisfies(semverMcVersion, '<1.13.0')
            ? 'universal'
            : 'installer'
        const filename = `forge-${mcVersion}-${forgeVersion}-${fileType}.jar`
        const filepath = path.join(config.rootDir, 'forgeInstallers', filename)

        if (!fs.existsSync(filepath)) {
            const downloadURL = `https://maven.minecraftforge.net/net/minecraftforge/forge/${mcVersion}-${forgeVersion}/${filename}`
            logger.info(`downloading ${downloadURL} to ${filepath}`)
            await download(downloadURL, filepath)
            logger.info(`${forgeVersion} downloaded`)
        }
        return filepath
    }
}

/**
 *
 * @param server the server url
 * @param remoteFolder object representing the remote folder to download (must not be the root of gameFolder, it should be the folder to download)
 * @param localFolder object representing the same folder but locally (I.E current state of the folder)
 * @param folderName name of the remote folder on the server
 * @param folderPath path to the local folder
 * @param pathA path to sub-folder to download (ex: ['folder1','test'] will download "gameFolder/folder1/test") (used the recreate path on disk)
 * @param totalFileCount the total number of file, used to update the current task
 * @param downloadStatus object used to count the file updated through the callstack to update the current task
 */
export async function downloadFolder(
    server: string,
    remoteFolder: Tree,
    localFolder: Tree,
    folderName: string,
    folderPath: string,
    pathA: string[] = [],
    totalFileCount: number,
    downloadStatus: { count: number } = { count: 0 }
) {
    for (const element of Object.keys(remoteFolder)) {
        const localPath = path.join(...pathA, element)
        const filepath = path.join(folderPath, localPath) // = absolute path to file
        const fileUrl = urlJoin(
            server,
            '/static/gameFolders',
            folderName,
            ...pathA,
            element
        )
        if (typeof remoteFolder[element] === 'string') {
            // Element is a file
            if (localFolder[element] !== undefined) {
                // if (
                //     pathA[0] !== undefined &&
                //     FOLDER_HASH_UPDATE_SKIP.includes(pathA[0])
                // ) {
                //     // Used to skip certain folder (like config) from being updated because we don't really care about them being up to date
                //     continue
                // }
                if ((await getHash(filepath)) !== remoteFolder[element]) {
                    logger.info('Updating file "%s"', localPath)
                    await download(fileUrl, filepath)
                    downloadStatus.count++
                    updateTask({
                        title: 'Updating Profile',
                        progress: (downloadStatus.count / totalFileCount) * 100
                    })
                }
            } else {
                logger.info('Downloading file "%s"', localPath)
                await download(fileUrl, filepath)
                downloadStatus.count++
                updateTask({
                    title: 'Updating Profile',
                    progress: (downloadStatus.count / totalFileCount) * 100
                })
            }
        } else {
            // Element is a folder
            if (!localFolder[element]) {
                fs.mkdirSync(filepath)
                localFolder[element] = {}
            }
            await downloadFolder(
                server,
                remoteFolder[element],
                localFolder[element] as Tree,
                folderName,
                folderPath,
                pathA.concat(element),
                totalFileCount,
                downloadStatus
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

async function refreshAuth() {
    if (authInfo) {
        authInfo = await authInfo?.refresh()
        fs.writeFileSync(authInfoPath, authInfo.save(), 'utf-8')
    }
}
