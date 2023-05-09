import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import * as path from 'path'
import * as os from 'os'
import * as fs from 'fs'
import * as msmc from 'msmc'
import { Client } from '@kensaa/minecraft-launcher-core'
import { Profile } from './src/types'
import * as http from 'http'
import * as crypto from 'crypto'
import { execSync, spawn } from 'child_process'
import decompress from 'decompress'

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
    console.log('createWindow')
    win = new BrowserWindow({
        title: 'Kensa Minecraft Launcher',
        width: 700,
        height: 700,
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    })

    if (fs.existsSync(path.join(configFolder, 'loginInfo.json'))) {
        loginInfo = JSON.parse(
            fs.readFileSync(path.join(configFolder, 'loginInfo.json'), 'utf-8')
        )
        if (!loginInfo) return
        if (!loginInfo.profile) return
        if (!msmc.validate(loginInfo.profile)) {
            console.log('login info not valid')
            msmc.refresh(loginInfo.profile).then(res => {
                console.log('refreshed login info')
                loginInfo = res
                fs.writeFileSync(
                    path.join(configFolder, 'loginInfo.json'),
                    JSON.stringify(loginInfo, null, 4)
                )
            })
        }
    }

    if (!fs.existsSync(path.join(configFolder, 'config.json'))) {
        config = defaultConfig
        fs.writeFileSync(
            path.join(configFolder, 'config.json'),
            JSON.stringify(config, null, 4)
        )
        console.log('created config file using default config : ')
        console.log(config)
    } else {
        config = JSON.parse(
            fs.readFileSync(path.join(configFolder, 'config.json'), 'utf-8')
        )
        // checking if config is missing field
        if (Object.keys(config).length !== Object.keys(defaultConfig).length) {
            console.log(
                'config seems to be missing some fields, using default config'
            )
            config = defaultConfig
            fs.writeFileSync(
                path.join(configFolder, 'config.json'),
                JSON.stringify(config, null, 4)
            )
        }
        console.log('parsed existing config:')
        console.log(config)
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
    const res = loginInfo ? loginInfo : {}
    event.returnValue = JSON.stringify(res)
})

ipcMain.handle('msmc-connect', (event, arg) => {
    return new Promise<boolean>(resolve => {
        msmc.fastLaunch('electron', info => {
            console.log(info)
            if (!info.percent) return
            loginProgress = info.percent
        })
            .then(res => {
                console.log('connected')
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
            .catch(res => {
                console.log('connection failed')
                resolve(false)
            })
    })
})

ipcMain.on('msmc-logout', (event, arg) => {
    console.log('msmc-logout')
    loginInfo = null
    fs.rmSync(path.join(configFolder, 'loginInfo.json'))
})

ipcMain.on('get-config', (event, arg) => {
    console.log('get-config')
    event.returnValue = JSON.stringify(config)
})

ipcMain.on('set-config', (event, arg) => {
    console.log('set-config')
    const newConfig = JSON.parse(arg)
    console.log(newConfig)
    config = { ...config, ...newConfig }
    fs.writeFileSync(
        path.join(configFolder, 'config.json'),
        JSON.stringify(config, null, 4)
    )
})

ipcMain.on('prompt-folder', (event, args) => {
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
    fs.writeFileSync(
        path.join(configFolder, 'selectedProfile.json'),
        JSON.stringify({ profile: args }, null, 4)
    )
})

ipcMain.handle('start-game', async (event, args: Profile) => {
    return new Promise<void>(async (resolve, reject) => {
        if (gameStarting) {
            reject('game already started')
            return
        }
        gameStarting = true
        console.log(config)
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
            console.log('CDN detected in config, testing if it is working')
            if (await checkServer(config.cdnServer)) {
                console.log('CDN working, setting it as download server')
                downloadServer = config.cdnServer
            } else {
                console.log(
                    'CDN server appear to be inaccessible, using primary server as download server'
                )
            }
        }

        let forgeArgs
        if (args.version.forge) {
            console.log('forge detected, downloading')
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
                console.log(`downloading ${forgeURL} to ${forgePath}`)
                await download(forgeURL, forgePath)
                console.log(`${args.version.forge} downloaded`)
            }
            forgeArgs = forgePath
        }
        if (!config.disableAutoUpdate) {
            if (args.gameFolder) {
                console.log(
                    'a forced game folder is detected, downloading it...'
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

                console.log('remote tree fetched')
                let localTree = await folderTree(localPath)
                console.log('local tree created')
                function getFolders(tree: any) {
                    return Object.keys(tree).filter(
                        key => typeof tree[key] !== 'string'
                    )
                }
                const remoteFolders = getFolders(remoteTree)
                const localFolders = getFolders(localTree)

                console.log('starting update procedure')
                for (const folder of remoteFolders) {
                    if (!localFolders.includes(folder)) {
                        fs.mkdirSync(path.join(localPath, folder))
                    }
                }
                localTree = await folderTree(localPath)

                let count = 0
                for (const folder of remoteFolders) {
                    //start recursive function which will download all files for all the folders
                    await downloadFolder(
                        remoteTree[folder],
                        localTree[folder],
                        path.join(args.gameFolder, folder),
                        path.join(localPath, folder)
                    )
                }
                async function downloadFolder(
                    remoteFolder,
                    localFolder,
                    gameFolder: string,
                    folderPath: string,
                    pathA: string[] = []
                ) {
                    for (const element of Object.keys(remoteFolder)) {
                        if (typeof remoteFolder[element] === 'string') {
                            if (localFolder[element] !== undefined) {
                                if (
                                    (await getHash(
                                        path.join(folderPath, ...pathA, element)
                                    )) !== remoteFolder[element]
                                ) {
                                    await download(
                                        urlJoin(
                                            downloadServer,
                                            '/static/gameFolders',
                                            gameFolder,
                                            ...pathA,
                                            element
                                        ),
                                        path.join(folderPath, ...pathA, element)
                                    )
                                    count++
                                    startProgress = Math.round(
                                        (count / fileCount) * 100
                                    )
                                }
                            } else {
                                await download(
                                    urlJoin(
                                        downloadServer,
                                        '/static/gameFolders',
                                        gameFolder,
                                        ...pathA,
                                        element
                                    ),
                                    path.join(folderPath, ...pathA, element)
                                )
                                count++
                                startProgress = Math.round(
                                    (count / fileCount) * 100
                                )
                            }
                        } else {
                            if (localFolder[element]) {
                                await downloadFolder(
                                    remoteFolder[element],
                                    localFolder[element],
                                    gameFolder,
                                    folderPath,
                                    pathA.concat(element)
                                )
                            } else {
                                fs.mkdirSync(
                                    path.join(folderPath, ...pathA, element)
                                )
                                await downloadFolder(
                                    remoteFolder[element],
                                    {},
                                    gameFolder,
                                    folderPath,
                                    pathA.concat(element)
                                )
                            }
                        }
                    }
                    const onlyLocalFile = Object.keys(localFolder)
                        .filter(key => typeof localFolder[key] === 'string')
                        .filter(key => !Object.keys(remoteFolder).includes(key))
                    for (const file of onlyLocalFile) {
                        console.log('deleting file : ' + file)
                        fs.rmSync(path.join(folderPath, ...pathA, file), {
                            recursive: true
                        })
                    }
                }
            } else {
                console.log(
                    'no forced game folder detected, creating an empty one...'
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

        //console.log(opts)
        launcher.launch(opts as any)
        //launcher.on('debug', e => console.log(e))
        launcher.on('data', e => console.log(e))
        launcher.on('start', e => {
            if (!config) return
            if (config.closeLauncher) setTimeout(app.quit, 5000)
            gameStarting = false
            resolve()
        })
        launcher.on('progress', progress => {
            if (typeof progress !== 'number') return
            //console.log("progress: "+progress+"%")
            startProgress = progress
        })
    })
})

ipcMain.on('get-start-progress', (event, arg) => {
    event.returnValue = startProgress
})

ipcMain.on('get-login-progress', (event, arg) => {
    event.returnValue = loginProgress
})
ipcMain.on('get-java-installation-progress', (event, arg) => {
    event.returnValue = javaInstallationProgress
})

ipcMain.on('get-java-version', (event, arg) => {
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
    return new Promise(async (resolve, reject) => {
        if (!config) reject('no config')
        const installDirectory = path.join(config.rootDir, 'java')
        if (fs.existsSync(installDirectory)) {
            fs.rmSync(installDirectory, { recursive: true, force: true })
        }
        fs.mkdirSync(installDirectory)
        const zipPath = path.join(installDirectory, 'java.zip')
        console.log('downloading binaries')
        execSync(`curl -o ${zipPath} ${javaBinariesLink} --ssl-no-revoke`)
        javaInstallationProgress = 50
        console.log('binaries downloaded')

        console.log('extracting archive')
        await decompress(zipPath, installDirectory)
        console.log('achive extracted')
        fs.rmSync(zipPath)

        javaInstallationProgress = 100
        resolve(path.join(installDirectory, 'jdk-19.0.2', 'bin', 'java.exe'))
    })
})

function checkExist(path: string) {
    console.log(path)
    if (!fs.existsSync(path)) {
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

function urlJoin(...args: string[]) {
    return encodeURI(
        args
            .map(e => e.replace(/\\/g, '/'))
            .join('/')
            .replace(/\/+/g, '/')
    )
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
        http.get(address, res => {
            res.on('end', () => resolve(true))
            res.on('data', chunk => {})
        }).on('error', err => resolve(false))
    })
}
function JSONFetch(address: string) {
    return new Promise((resolve, reject) => {
        http.get(address, res => {
            let data = ''
            res.on('data', chunk => (data += chunk))
            res.on('end', () => resolve(JSON.parse(data)))
        }).on('error', err => reject(err))
    })
}
