import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import * as path from 'path'
import * as os from 'os'
import * as fs from 'fs'
import { Auth, Xbox } from 'msmc'
import { Client, ILauncherOptions, IUser } from 'minecraft-launcher-core'
import type { Config, Profile, StartArgs, IPCHandlerResult } from '../src/types'
import { createLogger, setLogWindow } from './logger'

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
    setDifference
} from './utils'
import { fetchMcVersions, hashFile } from 'utils'
import { totalmem } from 'os'
import semver from 'semver'
import fetch from 'electron-fetch'

interface Task {
    title: string
    progress: number
}

const configFolders: Record<string, string> = {
    win32: path.join('AppData', 'Roaming', 'kensa-minecraft-launcher'),
    linux: path.join('.config', 'kensa-minecraft-launcher')
}
const rootDirs: Record<string, string> = {
    win32: path.join('AppData', 'Roaming', '.kensa-launcher'),
    linux: path.join('.kensa-launcher')
}

let win: BrowserWindow | null = null
let logWin: BrowserWindow | null = null
const platform = os.platform()
const supportedPlatforms = ['win32', 'linux']

const DIRECTORY_HASH_UPDATE_SKIP = ['config']

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

const defaultConfig: Config = {
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
let config: Config

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
        config = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as Config
        // checking if config is missing field
        const currentConfigKeys = new Set(Object.keys(config))
        const defaultConfigKeys = new Set(Object.keys(defaultConfig))
        const onlyCurrentConfigKeys = setDifference(
            currentConfigKeys,
            defaultConfigKeys
        ) as Set<keyof typeof config>
        const onlyDefaultConfigKeys = setDifference(
            defaultConfigKeys,
            currentConfigKeys
        ) as Set<keyof Config>
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
                key =>
                    ((config as Record<string, any>)[key] = defaultConfig[key])
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
        win.loadURL(process.env.VITE_DEV_SERVER_URL as string)
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
            (asset: any) =>
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
        event.returnValue = undefined
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
    const filepath = path.join(configFolder, 'selectedProfile.json')
    if (args == undefined) {
        if (fs.existsSync(filepath)) {
            fs.rmSync(filepath)
        }
    } else {
        fs.writeFileSync(filepath, JSON.stringify({ profile: args }, null, 4))
    }
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
        ) as Profile[]

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
                }
            }
        }
        // Migration to new profile Object
        localProfiles = localProfiles.map((profile, idx) => {
            if (profile.id === undefined) {
                profile.id = idx
            }
            if (profile.gameDirectory === undefined) {
                if (profile.gameFolder !== undefined) {
                    profile.gameDirectory = profile.gameFolder
                }
            }
            return profile
        })

        // Enforce unique ids
        const seenIds = new Set<number>()
        localProfiles = localProfiles.map(profile => {
            if (!seenIds.has(profile.id)) {
                seenIds.add(profile.id)
            } else {
                profile.id = Math.max(...seenIds.values()) + 1
                seenIds.add(profile.id)
            }
            return profile
        })

        // Migration to neoforge
        localProfiles = localProfiles.map(profile => {
            if (profile.version.isNeoforge === undefined) {
                profile.version.isNeoforge = false
            }
            return profile
        })

        // Migration for hidden profiles
        localProfiles = localProfiles.map(profile => {
            if (profile.hidden === undefined) {
                profile.hidden = false
            }
            return profile
        })
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
    return fetchMcVersions(fetch)
})

let gameStarting = false

ipcMain.handle(
    'start-game',
    async (_, args: StartArgs): Promise<IPCHandlerResult> => {
        logger.debug('start-game (async)')
        logger.info('Starting Game ...')
        if (gameStarting) {
            return { success: false, error: 'Game already starting' }
        }
        gameStarting = true
        if (!authInfo) return { success: false, error: 'Not logged in' }
        checkExist(path.join(config.rootDir, 'profiles'))
        checkExist(path.join(config.rootDir, 'addedMods'))
        checkExist(path.join(config.rootDir, 'java'))

        updateTask({
            title: 'Starting Game',
            progress: 0
        })

        const launcher = new Client()
        const timeExp = /(\[\d\d:\d\d:\d\d\])?(.*)/
        launcher.on('data', (e: string) => {
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

        launcher.on('debug', data => {
            logger.debug(data)
        })

        try {
            const launchOptions = await launchGame(args)
            logger.info('Launching Game')
            const game = await launcher.launch(launchOptions)
            if (game) {
                logger.info('Game Launched')
                gameStarting = false
                updateTask(undefined)
                if (config.closeLauncher) {
                    app.quit()
                } else if (config.openLogs) {
                    openLogs()
                }
            } else {
                logger.warning('Failed to launch game')
                return { success: false, error: 'Failed to start game' }
            }
        } catch (err) {
            if (err instanceof Error) {
                logger.warning(err)
                gameStarting = false
                return { success: false, error: err.message }
            }
        }
        return { success: true }
    }
)

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

    // game directory handling
    // if remote and specified => download/update
    // if remote and not specified => create
    // if local => create
    if (server && profile.gameDirectory) {
        logger.info(
            'A forced game directory is detected, checking for updates...'
        )
        const gameDirectoryPath = path.join(
            config.rootDir,
            'profiles',
            profile.gameDirectory
        )

        if (!fs.existsSync(gameDirectoryPath)) {
            logger.info(
                "The game directory doesn't exist, downloading a compressed version"
            )
            updateTask({
                title: 'Downloading Profile',
                progress: 0
            })
            fs.mkdirSync(gameDirectoryPath)
            const tarballFilename = profile.gameFolder + '.tar.gz'
            const tarballPath = path.join(gameDirectoryPath, tarballFilename)
            await download(
                urlJoin(server, 'tarball', profile.gameDirectory),
                tarballPath
            )
            updateTask({
                title: 'Downloading Profile',
                progress: 50
            })
            await decompress(tarballPath, gameDirectoryPath, {
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
            // const hashTree = await JSONFetch(urlJoin(server, 'hashes'))
            // const remoteTree = hashTree['gameFolders'][
            //     profile.gameFolder
            // ] as Tree
            const remoteTree = await JSONFetch(
                urlJoin(server, 'hashes', profile.gameDirectory)
            )
            const fileCount: number = (
                await JSONFetch(
                    urlJoin(server, 'fileCount', profile.gameDirectory)
                )
            ).count

            logger.info('Remote tree fetched')
            updateTask({
                title: 'Checking for update',
                progress: 50
            })
            const localTree = (await folderTree(gameDirectoryPath)) as Tree
            logger.info('Local tree created')
            function getDirectories(tree: any) {
                return Object.keys(tree).filter(
                    key => typeof tree[key] !== 'string'
                )
            }
            const remoteDirectories = getDirectories(remoteTree)
            const localDirectories = getDirectories(localTree)
            updateTask({
                title: 'Checking for update',
                progress: 100
            })

            logger.info('Starting update procedure')
            // creates all the directory at the root that does not exists
            for (const directory of remoteDirectories) {
                if (!localDirectories.includes(directory)) {
                    fs.mkdirSync(path.join(gameDirectoryPath, directory))
                    localTree[directory] = {}
                }
            }

            for (const directory of remoteDirectories) {
                //start recursive function which will download all files for all the directories
                await downloadDirectory(
                    server,
                    remoteTree[directory] as Tree,
                    localTree[directory] as Tree,
                    profile.gameDirectory,
                    gameDirectoryPath,
                    [directory],
                    fileCount
                )
            }
            logger.info('Update finished')
        }
    } else {
        if (!profile.gameDirectory) {
            logger.info(
                'No forced game directory detected, creating an empty one...'
            )
            profile.gameDirectory = profile.name
                .replace(/[^a-zA-Z0-9]/g, '_')
                .toLowerCase()
        } else {
            logger.info(
                'A forced game directory is detected, but profile is local, skipping update'
            )
        }
    }

    const gameDirectoryPath = path.join(
        config.rootDir,
        'profiles',
        profile.gameDirectory
    )

    // handle additional files
    logger.info('Copying additional files')
    const additionalFileDirectory = path.join(
        config.rootDir,
        'additionalFiles',
        profile.gameDirectory
    )
    checkExist(additionalFileDirectory)
    const additionalFiles = fs.readdirSync(additionalFileDirectory)
    if (additionalFiles.length > 0) {
        checkExist(gameDirectoryPath)
        fs.cpSync(additionalFileDirectory, gameDirectoryPath, {
            recursive: true
        })
    }

    // handle modloaders
    const isModded = profile.version.forge !== undefined
    const modloader = profile.version.isNeoforge ? 'neoforge' : 'forge'
    const modloaderFullVersion = `${modloader}-${profile.version.mc}-${profile.version.forge}`
    const forgePath = path.join(
        gameDirectoryPath,
        'versions',
        modloaderFullVersion,
        `${modloader}.jar`
    )
    if (isModded) {
        logger.info('profile is modded')
        logger.info(
            `modloader is ${modloader} version ${profile.version.forge}`
        )
        logger.info(`modloader full version ${modloaderFullVersion}`)
        if (modloader === 'forge') {
            await downloadForge(
                profile.version.mc,
                profile.version.forge!,
                forgePath
            )
        } else {
            await downloadNeoforge(profile.version.forge!, forgePath)
        }

        // Check if the forge / neoforge version has changed since last launch
        // If yes, delete the mclc forge cache directory
        // This is here so that if the profile's forge version changes, the game should not start on the old version
        const forgeCacheFile = path.join(
            gameDirectoryPath,
            'forge',
            profile.version.mc,
            'version.json'
        )
        if (fs.existsSync(forgeCacheFile)) {
            try {
                const forgeCache = JSON.parse(
                    fs.readFileSync(forgeCacheFile, 'utf-8')
                )
                const expectedID =
                    modloader === 'neoforge'
                        ? `neoforge-${profile.version.forge}`
                        : `${profile.version.mc}-forge-${profile.version.forge}`
                logger.debug(`current forgeCache id : ${forgeCache.id}`)
                logger.debug(`expected forgeCache id : ${expectedID}`)

                if (forgeCache.id !== expectedID) {
                    logger.info(
                        'The existing forge cache was made under another version of forge/neoforge, deleting it'
                    )
                    fs.rmSync(forgeCacheFile)
                }
            } catch {
                logger.warning(
                    'Failed to parse the forge cache file, deleting it'
                )
                fs.rmSync(forgeCacheFile)
            }
        }
    }
    logger.debug(`modloader path : ${forgePath}`)

    await refreshAuth()
    const auth = await authInfo?.getMinecraft()
    if (!auth) throw new Error('failed to get Minecraft auth info')
    return {
        clientPackage: undefined,
        authorization: auth.mclc(true) as IUser,
        root: gameDirectoryPath,
        version: {
            number: profile.version.mc,
            type: 'release',
            custom: isModded ? modloaderFullVersion : undefined
        },
        forge: isModded ? forgePath : undefined,
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
 * @param mcVersion the version of Minecraft
 * @param forgeVersion the version of Forge
 */
async function downloadForge(
    mcVersion: string,
    forgeVersion: string,
    downloadPath: string
) {
    // Check for old forge format (directly the forge installer)
    if (forgeVersion.endsWith('.jar')) {
        throw new Error('old forge format no longer supported')
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

        if (!fs.existsSync(downloadPath)) {
            const downloadURL = `https://maven.minecraftforge.net/net/minecraftforge/forge/${mcVersion}-${forgeVersion}/${filename}`
            logger.info(`Downloading ${downloadURL} to ${downloadPath}`)
            await download(downloadURL, downloadPath)
            logger.info(`${forgeVersion} downloaded`)
        }
    }
}

/**
 * Downloads a given version of neoforge
 * @param neoforgeVersion The version of Neoforge to download (ex:21.5.86)
 * @param downloadPath The path where neoforge will be downloaded
 */
async function downloadNeoforge(neoforgeVersion: string, downloadPath: string) {
    logger.info(`Downloading Neoforge version ${neoforgeVersion}`)
    const filename = `neoforge-${encodeURIComponent(neoforgeVersion)}-installer.jar`
    // const filepath = path.join(config.rootDir, 'neoforgeInstallers', filename)
    const downloadURL = `https://maven.neoforged.net/releases/net/neoforged/neoforge/${encodeURIComponent(neoforgeVersion)}/${filename}`

    if (!fs.existsSync(downloadPath)) {
        logger.info(`downloading ${downloadURL} to ${downloadPath}`)
        await download(downloadURL, downloadPath)
        logger.info(`Neoforge version ${neoforgeVersion} downloaded`)
    }
}

/**
 *
 * @param server the server url
 * @param remoteDirectory object representing the remote directory to download (must not be the root of gameDirectory, it should be the folder to download)
 * @param localDirectory object representing the same directory but locally (I.E current state of the directory)
 * @param directoryName name of the remote directory on the server
 * @param directoryPath path to the local directory
 * @param pathA path to sub-directory to download (ex: ['directory1','test'] will download "gameDirectories/directory1/test") (used the recreate path on disk)
 * @param totalFileCount the total number of file, used to update the current task
 * @param downloadStatus object used to count the file updated through the callstack to update the current task
 */
export async function downloadDirectory(
    server: string,
    remoteDirectory: Tree,
    localDirectory: Tree,
    directoryName: string,
    directoryPath: string,
    pathA: string[] = [],
    totalFileCount: number,
    downloadStatus: { count: number } = { count: 0 }
) {
    for (const element of Object.keys(remoteDirectory)) {
        const localPath = path.join(...pathA, element)
        const filepath = path.join(directoryPath, localPath) // = absolute path to file
        const fileUrl = urlJoin(
            server,
            '/static/gameDirectories',
            directoryName,
            ...pathA,
            element
        )
        if (typeof remoteDirectory[element] === 'string') {
            // Element is a file
            if (localDirectory[element] !== undefined) {
                // if (
                //     pathA[0] !== undefined &&
                //     FOLDER_HASH_UPDATE_SKIP.includes(pathA[0])
                // ) {
                //     // Used to skip certain directories (like config) from being updated because we don't really care about them being up to date
                //     continue
                // }
                if ((await hashFile(filepath)) !== remoteDirectory[element]) {
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
            // Element is a directory
            if (!localDirectory[element]) {
                fs.mkdirSync(filepath)
                localDirectory[element] = {}
            }
            await downloadDirectory(
                server,
                remoteDirectory[element],
                localDirectory[element] as Tree,
                directoryName,
                directoryPath,
                pathA.concat(element),
                totalFileCount,
                downloadStatus
            )
        }
    }
    const onlyLocalFile = Object.keys(localDirectory)
        .filter(key => typeof localDirectory[key] === 'string')
        .filter(key => !Object.keys(remoteDirectory).includes(key))
    for (const file of onlyLocalFile) {
        if (
            pathA[0] !== undefined &&
            DIRECTORY_HASH_UPDATE_SKIP.includes(pathA[0])
        ) {
            // Used to skip certain forlders (like config) from being deleted because we don't really care about them being up to date
            continue
        }
        const filepath = path.join(directoryPath, ...pathA, file)
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
