import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import Database from 'better-sqlite3'
import express from 'express'

const PORT = parseInt(process.env.PORT || '40069')
const DATA_FOLDER = process.env.DATA_FOLDER || './data'
const SERVER_NAME =
    process.env.SERVER_NAME || crypto.randomBytes(4).toString('hex')
const MASTER_SERVER = process.env.MASTER_SERVER
const GITHUB_TOKEN = process.env.GITHUB_TOKEN

const serverVersion = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8')
).version

if (!fs.existsSync(DATA_FOLDER)) {
    console.log(`data folder ${DATA_FOLDER} does not exist, creating it`)
    fs.mkdirSync(DATA_FOLDER)
}

if (process.env.SERVER_NAME === undefined) {
    console.log(
        `SERVER_NAME environement variables is not defined, using a random name : ${SERVER_NAME}`
    )
}

const database = new Database(path.join(DATA_FOLDER, 'database.db'))

database.exec(`
    CREATE TABLE IF NOT EXISTS Profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        mc_version TEXT NOT NULL,
        forge_version TEXT,
        game_directory TEXT
    );

    CREATE TABLE IF NOT EXISTS Files (
        profile_id INTEGER,
        file_path TEXT,
        last_modified INTEGER,
        hash TEXT,
        PRIMARY KEY (profile_id, file_path),
        FOREIGN KEY (profile_id) 
            REFERENCES Profiles (id) 
    );
`)

const app = express()
app.use(express.json())
