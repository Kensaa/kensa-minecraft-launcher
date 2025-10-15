import crypto, { randomBytes } from 'crypto'
import fs from 'fs'
import path from 'path'
import express from 'express'
import cors from 'cors'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { accountsTable, filesTable, profilesTable } from './db/schema'
import { count, eq } from 'drizzle-orm'
import { buildFileTree, getProfile, hashPassword, Tree } from './utils'
import * as webApi from './web-api/web-api'

const PORT = parseInt(process.env.PORT || '40069')
const DATA_DIRECTORY = process.env.DATA_FOLDER || './data'
const SERVER_NAME =
    process.env.SERVER_NAME || crypto.randomBytes(4).toString('hex')
const MASTER_SERVER = process.env.MASTER_SERVER // TODO: clone server at start
const GITHUB_TOKEN = process.env.GITHUB_TOKEN // TODO: download java version at start

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
    app.use(
        cors({
            allowedHeaders: ['X-Server-Name']
        })
    )
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
                .where(eq(filesTable.profile_id, profile.id))

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

    // New endpoint : only get the tree of the specified profile
    app.get('/hashes/:profile_id', async (req, res) => {
        const profile_id = parseInt(req.params.profile_id)
        if (Number.isNaN(profile_id))
            return res.status(500).send('invalid profile ID')

        const profile = await getProfile(db, profile_id)
        if (!profile) return res.sendStatus(404)

        const files = await db
            .select()
            .from(filesTable)
            .where(eq(filesTable.profile_id, profile.id))

        const fileTree = buildFileTree(files, file => file.hash)
        res.status(200).json(fileTree)
    })

    app.get('/fileCount/:profile_id', async (req, res) => {
        // the param for this request is supposed to be the id of the profile, but older version of the launcher pass the name of the gameDirectory as arg
        const profile_id = parseInt(req.params.profile_id)
        if (!Number.isNaN(profile_id)) {
            // arg is a number => check if it is an id
            const profile = await getProfile(db, profile_id)
            if (profile) {
                // arg is a profile id
                const files = await db
                    .select({ count: count() })
                    .from(filesTable)
                    .where(eq(filesTable.profile_id, profile.id))
                return res.status(200).json(files)
            }
        }
        // arg is not a profile id

        const profiles = await db
            .select()
            .from(profilesTable)
            .where(eq(profilesTable.game_directory, req.params.profile_id))
        if (profiles.length === 0) {
            return res.status(404).json({ count: 0 })
        } else {
            const profile = profiles[0]
            const files = await db
                .select({ count: count() })
                .from(filesTable)
                .where(eq(filesTable.profile_id, profile.id))
            return res.status(200).json(files)
        }
    })
})()
