import crypto, { randomBytes } from 'crypto'
import fs from 'fs'
import path from 'path'
import express from 'express'
import cors from 'cors'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { accountsTable, filesTable, profilesTable } from './db/schema'
import { count, eq } from 'drizzle-orm'
import { buildFileTree, getGameDirectory, hashPassword } from './utils'
import * as webApi from './web-api/web-api'
import { Tree } from 'utils'

const PORT = parseInt(process.env.PORT || '40069')
const DATA_DIRECTORY = process.env.DATA_FOLDER || './data'
const SERVER_NAME =
    process.env.SERVER_NAME || crypto.randomBytes(4).toString('hex')
const MASTER_SERVER = process.env.MASTER_SERVER // TODO: clone server at start
const GITHUB_TOKEN = process.env.GITHUB_TOKEN // TODO: download java version at start
const IS_DEV = process.env.NODE_ENV !== 'production'

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

    const webApiRouter = webApi.createRouter({
        database: db,
        staticDirectory: STATIC_DIRECTORY,
        authSecret: randomBytes(64).toString('hex')
    })
    app.use('/web-api', webApiRouter.getRouter())
    app.get('/', (req, res) => res.sendStatus(200))
    app.get('/version', (req, res) => res.status(200).send(serverVersion))
    app.use('/static/', express.static(STATIC_DIRECTORY))

    app.get('/profiles', async (req, res) => {
        const profiles = await db.select().from(profilesTable)
        const reformattedProfiles = profiles.map(profile => ({
            id: profile.id,
            name: profile.name,
            version: {
                mc: profile.mc_version,
                forge: profile.forge_version ?? undefined
            },
            gameFolder: profile.game_directory ?? undefined, // for backward compat
            gameDirectory: profile.game_directory ?? undefined
        }))

        res.status(200).json(reformattedProfiles)
    })

    // Returns the entire hash tree (for backward compat)
    app.get('/hashes', async (req, res) => {
        const profilesTree: Tree<string> = {}
        const profiles = await db.select().from(profilesTable)
        for (const profile of profiles) {
            if (!profile.game_directory) continue
            const profileFiles = await db
                .select()
                .from(filesTable)
                .where(eq(filesTable.game_directory, profile.game_directory))

            profilesTree[profile.game_directory] = buildFileTree(
                profileFiles,
                file => file.hash
            )
        }

        const result = {
            gameFolders: profilesTree
        }

        res.status(200).json(result)
    })

    // New endpoint : only get the tree of the specified game directory
    app.get('/hashes/:game_directory', async (req, res) => {
        const gameDirectory = await getGameDirectory(
            db,
            req.params.game_directory
        )
        if (!gameDirectory) return res.sendStatus(404)

        const files = await db
            .select()
            .from(filesTable)
            .where(eq(filesTable.game_directory, gameDirectory.name))

        const fileTree = buildFileTree(files, file => file.hash)
        res.status(200).json(fileTree)
    })

    app.get('/fileCount/:game_directory', async (req, res) => {
        const game_directory = await getGameDirectory(
            db,
            req.params.game_directory
        )
        if (!game_directory) return res.status(404).json({ count: 0 })
        const files = await db
            .select({ count: count() })
            .from(filesTable)
            .where(eq(filesTable.game_directory, game_directory.name))
        return res.status(200).json(files[0])
    })
})()
