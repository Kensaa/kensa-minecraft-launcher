import { APIRouter as BaseApiRouter } from 'express-api-router'
import { APIInstances } from '../utils'
import { getProfilesHandler } from './routes/getProfiles'
import { getHashesLegacy } from './routes/getHashesLegacy'
import { getHashes } from './routes/getHashes'
import { getFileCount } from './routes/getFileCount'
import { getTarball } from './routes/getTarball'

export function createRouter(instances: APIInstances) {
    const router = new BaseApiRouter(instances)

    router.registerRoute('get', '/profiles', getProfilesHandler(router))
    router.registerRoute('get', '/hashes', getHashesLegacy(router))
    router.registerRoute('get', '/hashes/:game_directory', getHashes(router))
    router.registerRoute(
        'get',
        '/fileCount/:game_directory',
        getFileCount(router)
    )
    router.registerRoute('get', '/tarball/:game_directory', getTarball(router))
    router.registerRoute(
        'get',
        '/static/tarballs/:game_directory',
        getTarball(router)
    )

    return router
}

export type APIRouter = ReturnType<typeof createRouter>
