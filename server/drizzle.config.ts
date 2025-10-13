import 'dotenv/config'
import path from 'path'
import fs from 'fs'
import { defineConfig } from 'drizzle-kit'
const DATA_DIRECTORY = process.env.DATA_DIRECTORY ?? './data'

if (!fs.existsSync(DATA_DIRECTORY)) {
    fs.mkdirSync(DATA_DIRECTORY)
}

export default defineConfig({
    out: './drizzle',
    schema: './src/db/schema.ts',
    dialect: 'sqlite',
    dbCredentials: {
        url: path.join(process.env.DATA_FOLDER ?? './data', 'database.db')
    }
})
