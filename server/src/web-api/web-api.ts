import {
    APIRouter as BaseApiRouter,
    createJWTAuthHandler
} from 'express-api-router'
import { Database } from '../utils'
import cookieParser from 'cookie-parser'
import { loginHandler } from './routes/account/login'
import { registerHandler } from './routes/account/register'
import { meHandler } from './routes/account/me'
import { logoutHandler } from './routes/account/logout'
import { createProfileHandler } from './routes/profile/createProfile'
import { deleteProfileHandler } from './routes/profile/deleteProfile'
import { getProfilesHandler } from './routes/profile/getProfiles'
import { getProfileFilesHandler } from './routes/profile/getProfileFiles'
import { deleteProfileFileHandler } from './routes/profile/deleteProfileFile'
import { uploadProfileFileHandler } from './routes/profile/uploadProfileFile'
import { refreshProfileHandler } from './routes/profile/refreshProfile'

export interface APIInstances {
    database: Database
    staticDirectory: string
    authSecret: string
}
export type AuthedUserData = {
    id: number
    username: string
    is_admin: boolean
}

export function createRouter(instances: APIInstances) {
    const authHandler = createJWTAuthHandler<AuthedUserData>({
        tokenSource: 'cookie',
        cookieName: 'auth-token',
        auth_secret: instances.authSecret
    })
    const router = new BaseApiRouter<APIInstances, AuthedUserData>(
        instances,
        authHandler
    )

    router.getRouter().use(cookieParser())
    router.registerRoute('post', '/account/login', loginHandler(router))
    router.registerRoute('post', '/account/register', registerHandler(router))
    router.registerRoute('get', '/account/me', meHandler(router))
    router.registerRoute('post', '/account/logout', logoutHandler(router))

    router.registerRoute('put', '/profile', createProfileHandler(router))
    router.registerRoute(
        'delete',
        '/profile/:profile_id',
        deleteProfileHandler(router)
    )
    router.registerRoute('get', '/profiles', getProfilesHandler(router))
    router.registerRoute(
        'get',
        '/profile/:profile_id/files',
        getProfileFilesHandler(router)
    )
    router.registerRoute(
        'delete',
        '/profile/:profile_id/file',
        deleteProfileFileHandler(router)
    )
    router.registerRoute(
        'post',
        '/profile/:profile_id/file',
        uploadProfileFileHandler(router)
    )

    router.registerRoute(
        'post',
        '/profile/:profile_id/refresh',
        refreshProfileHandler(router)
    )

    return router
}
export type APIRouter = ReturnType<typeof createRouter>
