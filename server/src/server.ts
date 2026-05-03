import crypto, { randomBytes } from 'crypto'
import fs from 'fs'
import path from 'path'
import express from 'express'
import cors from 'cors'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { accountsTable } from './db/schema'
import { count, eq } from 'drizzle-orm'
import { APIInstances, downloadJavaRuntime, hashPassword } from './utils'
import * as webApi from './web-api/web-api'
import * as launcherApi from './launcher-api/launcher-api'

const PORT = parseInt(process.env.PORT || '40069')
const DATA_DIRECTORY = process.env.DATA_FOLDER || './data'
const SERVER_NAME =
    process.env.SERVER_NAME || crypto.randomBytes(4).toString('hex')
const IS_DEV = process.env.NODE_ENV !== 'production'

const expectedJavaRuntimesVersion = [8, 17, 22]
const expectedJavaRuntimesPlatform = ['linux', 'win32']

const serverVersion = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8')
).version

if (!fs.existsSync(DATA_DIRECTORY)) {
    console.log(`data directory ${DATA_DIRECTORY} does not exist, creating it`)
    fs.mkdirSync(DATA_DIRECTORY)
}

if (process.env.SERVER_NAME === undefined) {
    console.log(
        `SERVER_NAME environement variables is not defined, using a random name : ${SERVER_NAME}`
    )
}

const STATIC_DIRECTORY = path.join(DATA_DIRECTORY, 'static')
if (!fs.existsSync(STATIC_DIRECTORY)) {
    fs.mkdirSync(STATIC_DIRECTORY)
}

;(async () => {
    const db = drizzle(path.join(DATA_DIRECTORY, 'database.db'))
    migrate(db, { migrationsFolder: 'drizzle' })

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

    const app = express()
    app.use(express.json())
    if (IS_DEV) {
        app.use(
            cors({
                allowedHeaders: [
                    'X-Server-Name',
                    'Content-Type',
                    'Authorization'
                ],
                credentials: true,
                origin: ['http://localhost:5173', 'http://localhost:5174'] // server-ui and launcher vite dev servers
            })
        )
    }
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

    app.get('/', (req, res) => res.sendStatus(200))
    app.get('/version', (req, res) => res.status(200).send(serverVersion))
    app.use('/static/', express.static(STATIC_DIRECTORY))
})()
