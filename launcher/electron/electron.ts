import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import * as path from 'path'
import * as os from 'os'
import * as fs from 'fs'
import * as msmc from 'msmc'
import { Client } from '@kensaa/minecraft-launcher-core'
import { Profile } from '../src/types'
import * as http from 'http'
import * as crypto from 'crypto'
import { execSync, spawn } from 'child_process'
import decompress from 'decompress'
import fetch from 'electron-fetch'
import { urlJoin } from './url-join'
import { pino, multistream } from 'pino'
import pretty from 'pino-pretty'
import 'source-map-support/register'

const javaBinariesLink =
    'https://download.oracle.com/java/19/archive/jdk-19.0.2_windows-x64_bin.zip'

const launcher = new Client()

let win: BrowserWindow | null = null
const platorm = os.platform()
let configFolder = ''
let rootDir
let startProgress = 0
let loginProgress = 0
let javaInstallationProgress = 0
let gameStarting = false

if (platorm === 'win32') {
    configFolder = path.join(
        os.homedir(),
        'AppData',
        'Roaming',
        'kensa-minecraft-launcher'
    )
    rootDir = path.join(os.homedir(), 'AppData', 'Roaming', '.kensa-launcher')
} else if (platorm === 'linux') {
    configFolder = path.join(
        os.homedir(),
        '.config',
        'kensa-minecraft-launcher'
    )
    rootDir = path.join(os.homedir(), '.kensa-launcher')
} else {
    console.error('Unsupported platform')
    process.exit(1)
}
const LOG_FILE = path.join(configFolder, 'launcher.log')
if (fs.existsSync(LOG_FILE)) fs.rmSync(LOG_FILE)
const customLevels = { trace: 10, debug: 20, info: 30, game: 31 }
const logger = pino(
    { level: 'trace', customLevels },
    multistream([
        { level: 'trace', stream: fs.createWriteStream(LOG_FILE) },
        {
            level: 'trace',
            stream: pretty({
                customLevels,
                //@ts-ignore
                customColors: 'trace:gray,debug:blue,info:green,game:yellow'
            })
        }
    ])
)

let primaryServer = 'http://redover.fr:40069'
if (!app.isPackaged) {
    primaryServer = 'http://localhost:40069'
}

const defaultConfig = {
    rootDir,
    ram: 4,
    primaryServer,
    cdnServer: '',
    jrePath: '',
    closeLauncher: true,
    disableAutoUpdate: false
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
                msmc.refresh(loginInfo.profile).then(res => {
                    logger.info('refreshed login info')
                    loginInfo = res
                    fs.writeFileSync(
                        loginInfoPath,
                        JSON.stringify(loginInfo, null, 4)
                    )
                })
            }
        } else {
            logger.warn('login info file is corrupted, deleting')
            fs.rmSync(loginInfoPath)
        }
    }

    if (!fs.existsSync(path.join(configFolder, 'config.json'))) {
        config = { ...defaultConfig }
        fs.writeFileSync(
            path.join(configFolder, 'config.json'),
            JSON.stringify(config, null, 4)
        )
        logger.child(config).info('created config file using default config:')
    } else {
        config = JSON.parse(
            fs.readFileSync(path.join(configFolder, 'config.json'), 'utf-8')
        )
        // checking if config is missing field
        if (Object.keys(config).length !== Object.keys(defaultConfig).length) {
            logger.warn(
                'config seems to be missing some fields, resetting to default config'
            )
            config = defaultConfig
            fs.writeFileSync(
                path.join(configFolder, 'config.json'),
                JSON.stringify(config, null, 4)
            )
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
        msmc.fastLaunch('electron', info => {
            if (!info.percent) return
            loginProgress = info.percent
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
    fs.writeFileSync(
        path.join(configFolder, 'config.json'),
        JSON.stringify(config, null, 4)
    )
})

ipcMain.on('reset-config', (event, arg) => {
    logger.debug('reset-config')
    config = { ...defaultConfig }
    fs.writeFileSync(
        path.join(configFolder, 'config.json'),
        JSON.stringify(config, null, 4)
    )
    event.returnValue = undefined
})

ipcMain.on('prompt-folder', (event, args) => {
    logger.debug('prompt-folder')
    if (!win) return (event.returnValue = 'error')
    const dir = dialog.showOpenDialogSync(win, {
        properties: ['openDirectory']
    })
    if (dir) {
        event.returnValue = dir[0]
    } else {
        event.returnValue = undefined
    }
})

ipcMain.on('prompt-file', (event, args) => {
    logger.debug('prompt-file')
    if (!win) return (event.returnValue = 'error')
    const dir = dialog.showOpenDialogSync(win, {
        properties: ['openFile']
    })
    if (dir) {
        event.returnValue = dir[0]
    } else {
        event.returnValue = undefined
    }
})

ipcMain.on('get-selected-profile', (event, args) => {
    logger.debug('get-selected-profile')
    if (!fs.existsSync(path.join(configFolder, 'selectedProfile.json'))) {
        event.returnValue = JSON.stringify(0)
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

ipcMain.handle('start-game', async (event, args: Profile) => {
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

        // cdn check
        const { primaryServer } = config
        let downloadServer = primaryServer

        if (!(await checkServer(primaryServer))) {
            // checking if server is accessible
            gameStarting = false
            reject(
                "server is not accessible, either your config is wrong or you don't have an internet connection"
            )
        }

        if (config.cdnServer && config.cdnServer !== '') {
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

        let forgeArgs
        if (args.version.forge) {
            logger.info('Forge detected, downloading forge installer')
            const forgePath = path.join(
                config.rootDir,
                'forgeInstallers',
                args.version.forge
            )
            if (!fs.existsSync(forgePath)) {
                const forgeURL = urlJoin(
                    downloadServer,
                    '/static/forges/',
                    args.version.forge
                )
                logger.info(`downloading ${forgeURL} to ${forgePath}`)
                await download(forgeURL, forgePath)
                logger.info(`${args.version.forge} downloaded`)
            }
            forgeArgs = forgePath
        }
        if (!config.disableAutoUpdate) {
            if (args.gameFolder) {
                logger.info(
                    'A forced game folder is detected, downloading it...'
                )
                const localPath = path.join(
                    config.rootDir,
                    'profiles',
                    args.gameFolder
                )
                checkExist(localPath)

                const hashTree = (await JSONFetch(
                    urlJoin(primaryServer, '/hashes')
                )) as any
                const remoteTree = hashTree['gameFolders'][args.gameFolder]
                const fileCount = (
                    (await JSONFetch(
                        urlJoin(primaryServer, '/fileCount', args.gameFolder)
                    )) as { count: number }
                ).count

                logger.info('Remote tree fetched')
                let localTree = await folderTree(localPath)
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
                        args.gameFolder,
                        localPath,
                        [folder]
                    )
                }
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
                                    (await getHash(filepath)) !==
                                    remoteFolder[element]
                                ) {
                                    logger.info('Updating file "%s"', localPath)
                                    await download(fileUrl, filepath)
                                    count++
                                    startProgress = Math.round(
                                        (count / fileCount) * 100
                                    )
                                }
                            } else {
                                logger.info('Downloading file "%s"', localPath)
                                await download(fileUrl, filepath)
                                count++
                                startProgress = Math.round(
                                    (count / fileCount) * 100
                                )
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
                logger.info(
                    'No forced game folder detected, creating an empty one...'
                )
                args.gameFolder = args.name
                    .replace(/[^a-zA-Z0-9]/g, '_')
                    .toLowerCase()
            }
        } else {
            args.gameFolder = args.name
                .replace(/[^a-zA-Z0-9]/g, '_')
                .toLowerCase()
        }

        let opts = {
            clientPackage: null,
            authorization: msmc.getMCLC().getAuth(loginInfo),
            root: config.rootDir,
            version: {
                number: args.version.mc,
                type: 'release'
            },
            forge: forgeArgs,
            memory: {
                max: config.ram + 'G',
                min: '1G'
            },
            javaPath: config.jrePath !== '' ? config.jrePath : undefined,
            customArgs: ['-Djava.net.preferIPv6Stack=true'],
            overrides: {
                detached: config.jrePath !== '',
                gameDirectory: path.join(
                    config.rootDir,
                    'profiles',
                    args.gameFolder
                )
            }
        }

        launcher.launch(opts as any)

        launcher.on('data', e => {
            // sometimes multiple lines arrive at once
            for (let s of e.trim().split('\n')) logger.game(s.trim())
        })
        launcher.on('start', e => {
            if (!config) return
            if (config.closeLauncher) setTimeout(app.quit, 5000)
            gameStarting = false
            resolve()
        })
        launcher.on('progress', progress => {
            if (typeof progress !== 'number') return
            startProgress = progress
        })
    })
})

ipcMain.on('get-start-progress', (event, arg) => {
    logger.debug('get-start-progress')
    event.returnValue = startProgress
})

ipcMain.on('get-login-progress', (event, arg) => {
    logger.debug('get-login-progress')
    event.returnValue = loginProgress
})
ipcMain.on('get-java-installation-progress', (event, arg) => {
    logger.debug('get-java-installation-progress')
    event.returnValue = javaInstallationProgress
})

ipcMain.on('get-java-version', (event, arg) => {
    logger.debug('get-java-version')
    if (!config) return
    const javaPath = config.jrePath !== '' ? config.jrePath : 'java'
    const java = spawn(javaPath, ['-version'])
    java.stderr.on('data', data => {
        data = data.toString().split('\n')[0]
        let javaVersion = new RegExp('java version').test(data)
            ? data.split(' ')[2].replace(/"/g, '')
            : false
        if (javaVersion != false) {
            event.returnValue = javaVersion
        } else {
            event.returnValue = null
        }
    })
    java.on('error', e => {
        event.returnValue = null
    })
})

ipcMain.handle('install-java', async (event, arg) => {
    logger.debug('install-java (async)')
    logger.info('Installing Java ...')
    return new Promise(async (resolve, reject) => {
        if (!config) reject('no config')
        const installDirectory = path.join(config.rootDir, 'java')
        if (fs.existsSync(installDirectory)) {
            fs.rmSync(installDirectory, { recursive: true, force: true })
        }
        fs.mkdirSync(installDirectory)
        javaInstallationProgress = 1
        const zipPath = path.join(installDirectory, 'java.zip')
        logger.info('Downloading binaries')
        execSync(`curl -o ${zipPath} ${javaBinariesLink} --ssl-no-revoke`)
        javaInstallationProgress = 50
        logger.info('Binaries downloaded')

        logger.info('Extracting archive')
        await decompress(zipPath, installDirectory)
        logger.info('Achive extracted')
        fs.rmSync(zipPath)

        javaInstallationProgress = 100
        resolve(path.join(installDirectory, 'jdk-19.0.2', 'bin', 'java.exe'))
    })
})

function checkExist(path: string) {
    if (!fs.existsSync(path)) {
        logger.info("%s don't exist, creating", path)
        fs.mkdirSync(path)
    }
}

function download(address: string, filepath: string) {
    return new Promise<void>((resolve, reject) => {
        if (fs.existsSync(path.dirname(filepath))) {
            fs.mkdirSync(path.dirname(filepath), { recursive: true })
        }
        if (fs.existsSync(filepath)) {
            fs.writeFileSync(filepath, '')
        }
        const file = fs.createWriteStream(filepath)
        http.get(address, res => {
            res.pipe(file)
            file.on('finish', () => {
                file.close()
                resolve()
            })
        }).on('error', err => reject(err))
    })
}

function getHash(src: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        const stream = fs.createReadStream(src)
        const hash = crypto.createHash('md5')
        stream.on('end', () => resolve(hash.digest('hex')))
        stream.on('error', err => reject(err))
        stream.pipe(hash)
    })
}

async function folderTree(
    src: string
): Promise<Record<string, unknown> | string> {
    if (fs.statSync(src).isFile()) {
        return ''
    } else {
        const res: { [k: string]: Record<string, unknown> | string } = {}
        const files = fs.readdirSync(src)
        for (const file of files) {
            const filePath = path.join(src, file)
            const fileInfo = await folderTree(filePath)
            res[file] = fileInfo
        }
        return res
    }
}

function checkServer(address: string) {
    return new Promise<boolean>((resolve, reject) => {
        fetch(address)
            .then(res => resolve(true))
            .catch(err => resolve(false))
    })
}
function JSONFetch(address: string) {
    return fetch(address).then(res => res.json())
}
