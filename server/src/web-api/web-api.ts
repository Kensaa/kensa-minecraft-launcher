import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { APIRouter as BaseApiRouter } from 'express-api-router'
import { Database } from '../utils'

export interface APIInstances {
    database: Database
}
export type AuthedUserData = never

export function createRouter(instances: APIInstances) {
    const router = new BaseApiRouter<APIInstances, AuthedUserData>(instances)

    return router
}
export type APIRouter = ReturnType<typeof createRouter>
