import { APIRouter as BaseApiRouter } from 'express-api-router'
import { APIInstances } from '../utils'
import { getProfilesHandler } from './routes/getProfiles'

export function createRouter(instances: APIInstances) {
    const router = new BaseApiRouter(instances)

    router.registerRoute('get', '/profiles', getProfilesHandler(router))

    return router
}

export type APIRouter = ReturnType<typeof createRouter>
