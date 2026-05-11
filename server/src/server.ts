import crypto, { randomBytes } from 'crypto'
import fs from 'fs'
import path from 'path'
import express from 'express'
import cors from 'cors'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { accountsTable, gameDirectoriesTable, profilesTable } from './db/schema'
import { count, eq } from 'drizzle-orm'
import {
    APIInstances,
    downloadJavaRuntime,
    hashPassword,
    refreshGameDirectory
} from './utils'
import * as webApi from './web-api/web-api'
import * as launcherApi from './launcher-api/launcher-api'

const PORT = parseInt(process.env.PORT || '40069')
const DATA_DIRECTORY = process.env.DATA_DIRECTORY || './data'
const IS_DEV = process.env.NODE_ENV !== 'production'
const SERVER_NAME =
    process.env.SERVER_NAME ||
    (IS_DEV ? 'dev' : crypto.randomBytes(4).toString('hex'))
const CURSEFORGE_API_KEY_BASE64 = process.env.CURSEFORGE_API_KEY_BASE64

const expectedJavaRuntimesVersion = [8, 17, 22]
const expectedJavaRuntimesPlatform = ['linux', 'win32']

const serverVersion = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8')
).version

console.log('IS DEV : ', IS_DEV)

if (!fs.existsSync(DATA_DIRECTORY)) {
    console.log(`data directory ${DATA_DIRECTORY} does not exist, creating it`)
    fs.mkdirSync(DATA_DIRECTORY)
}
console.log('data directory : ', DATA_DIRECTORY)

if (process.env.SERVER_NAME === undefined) {
    console.log(
        `SERVER_NAME environement variables is not defined, using a random name : ${SERVER_NAME}`
    )
}
if (CURSEFORGE_API_KEY_BASE64 === undefined) {
    console.error(
        'Please specify the CURSEFORGE_API_KEY env variable (see: https://console.curseforge.com/)'
    )
    process.exit(1)
}

const STATIC_DIRECTORY = path.join(DATA_DIRECTORY, 'static')
if (!fs.existsSync(STATIC_DIRECTORY)) {
    fs.mkdirSync(STATIC_DIRECTORY)
}

process.on('SIGINT', () => {
    console.log('Shutting down...')
    process.exit(0)
})
;(async () => {
    const db = drizzle(path.join(DATA_DIRECTORY, 'database.db'))
    migrate(db, { migrationsFolder: path.join(__dirname, '..', 'drizzle') })

    // check temp account
    const tempAccountCount = (
        await db
            .select({ count: count() })
            .from(accountsTable)
            .where(eq(accountsTable.temp_account, true))
    )[0].count
    const normalAccountCount = (
        await db
            .select({ count: count() })
            .from(accountsTable)
            .where(eq(accountsTable.temp_account, false))
    )[0].count

    if (normalAccountCount === 0) {
        if (tempAccountCount === 0) {
            // create a temp account
            const randomPassword = crypto.randomBytes(16).toString('hex')
            const salt = crypto.randomBytes(32)
            const hash = hashPassword(
                Buffer.from(randomPassword, 'utf-8'),
                salt
            )
            console.log('created temp account :')
            console.log(`username: admin`)
            console.log(`password: ${randomPassword}`)
            await db.insert(accountsTable).values({
                hash: hash,
                salt: salt,
                username: 'admin',
                temp_account: true,
                is_admin: true
            })
        }
    } else {
        if (tempAccountCount !== 0) {
            // delete all temp account
            await db
                .delete(accountsTable)
                .where(eq(accountsTable.temp_account, true))
        }
    }

    const runtimeDirectory = path.join(STATIC_DIRECTORY, 'java')
    if (!fs.existsSync(runtimeDirectory)) fs.mkdirSync(runtimeDirectory)
    const runtimeFiles = fs.readdirSync(runtimeDirectory)
    for (const runtimeVersion of expectedJavaRuntimesVersion) {
        for (const runtimePlatform of expectedJavaRuntimesPlatform) {
            const runtimeFile = `${runtimePlatform}-${runtimeVersion}.tar.gz`
            if (!runtimeFiles.includes(runtimeFile)) {
                console.log(
                    `missing runtime version ${runtimeVersion} for ${runtimePlatform}, downloading ...`
                )
                await downloadJavaRuntime(
                    runtimeVersion,
                    runtimePlatform,
                    path.join(STATIC_DIRECTORY, 'java', runtimeFile)
                )
                console.log(`downloaded runtime`)
            }
        }
    }

    // old profiles file migration
    const oldProfileFilePath = path.join(DATA_DIRECTORY, 'profiles.json')
    if (fs.existsSync(oldProfileFilePath)) {
        console.log('migrating old profile file to the database')
        try {
            fs.renameSync(
                path.join(STATIC_DIRECTORY, 'gameFolders'),
                path.join(STATIC_DIRECTORY, 'gameDirectories')
            )
        } catch (err) {
            console.warn(
                'failed to rename "gameFolders" to "gameDirectories"',
                err
            )
        }
        try {
            const oldProfiles = JSON.parse(
                fs.readFileSync(oldProfileFilePath, 'utf-8')
            ) as {
                name: string
                version: {
                    mc: string
                    forge?: string
                }
                gameFolder?: string
            }[]

            for (const oldProfile of oldProfiles) {
                const existingProfile = await db
                    .select()
                    .from(profilesTable)
                    .where(eq(profilesTable.name, oldProfile.name))
                if (existingProfile.length > 0) {
                    console.warn(
                        `skipping ${oldProfile.name} because there is already a profile with the same name in the database`
                    )
                    continue
                }

                if (oldProfile.gameFolder !== undefined) {
                    const existingGameDirectory = await db
                        .select()
                        .from(gameDirectoriesTable)
                        .where(
                            eq(gameDirectoriesTable.name, oldProfile.gameFolder)
                        )
                    if (existingGameDirectory.length > 0) {
                        console.warn(
                            `skipping ${oldProfile.name} because there is already a game directory with the same name (${oldProfile.gameFolder}) in the database`
                        )
                        continue
                    }
                    const newGameDirectory = await db
                        .insert(gameDirectoriesTable)
                        .values({
                            name: oldProfile.gameFolder
                        })
                        .returning()

                    await refreshGameDirectory(
                        STATIC_DIRECTORY,
                        db,
                        newGameDirectory[0]
                    )
                }
                await db.insert(profilesTable).values({
                    name: oldProfile.name,
                    mc_version: oldProfile.version.mc,
                    forge_version: oldProfile.version.forge ?? undefined,
                    game_directory: oldProfile.gameFolder ?? undefined
                })
            }
            fs.renameSync(oldProfileFilePath, oldProfileFilePath + '.migrated')
        } catch (err) {
            console.warn('failed to mirgrate old profiles', err)
        }
    }

    const app = express()
    app.use(express.json())
    app.use(
        cors({
            // allowedHeaders: [ 'Content-Type', 'Authorization'],
            exposedHeaders: ['X-Server-Name'],
            credentials: true,
            origin: IS_DEV
                ? ['http://localhost:5173', 'http://localhost:5174']
                : true // server-ui and launcher vite dev servers
        })
    )
    app.use((_, res, next) => {
        res.setHeader('X-Server-Name', SERVER_NAME)
        next()
    })
    app.listen(PORT, () => console.log(`server listening on port ${PORT}`))

    const apiInstances: APIInstances = {
        database: db,
        staticDirectory: STATIC_DIRECTORY,
        authSecret: randomBytes(64).toString('hex')
    }
    const webApiRouter = webApi.createRouter(apiInstances)
    app.use('/web-api', webApiRouter.getRouter())
    const launcherApiRouter = launcherApi.createRouter(apiInstances)
    app.use('/', launcherApiRouter.getRouter())

    app.get('/version', (req, res) => res.status(200).send(serverVersion))
    app.use(
        '/static/',
        express.static(STATIC_DIRECTORY, {
            setHeaders: (res, filePath) => {
                const filename = path.basename(filePath)
                res.setHeader(
                    'Content-Disposition',
                    `attachment; filename="${filename}"`
                )
            }
        })
    )
    // for legacy file download
    app.use(
        '/static/gameFolders',
        express.static(path.join(STATIC_DIRECTORY, 'gameDirectories'))
    )

    const PUBLIC_PATH = path.resolve(__dirname, '..', 'public/')

    if (!fs.existsSync(PUBLIC_PATH)) fs.mkdirSync(PUBLIC_PATH)
    console.log('public folder :', PUBLIC_PATH)
    app.use('/', express.static(PUBLIC_PATH))
    app.use((req, res) => {
        res.sendFile(path.join(PUBLIC_PATH, 'index.html'))
    })
})()
