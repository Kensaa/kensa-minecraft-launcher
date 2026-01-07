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
import { getMinecraftVersionHandler } from './routes/getMinecraftVersions'
import { createGameDirectoryHandler } from './routes/gameDirectory/createGameDirectory'
import { deleteGameDirectoryHandler } from './routes/gameDirectory/deleteGameDirectory'
import { getGameDirectories } from './routes/gameDirectory/getGameDirectories'
import { deleteGameDirectoryFileHandler } from './routes/gameDirectory/deleteGameDirectoryFile'
import { getGameDirectoryFilesHandler } from './routes/gameDirectory/getGameDirectoryFiles'
import { uploadGameDirectoryFileHandler } from './routes/gameDirectory/uploadGameDirectoryFile'
import { refreshGameDirectoryHandler } from './routes/gameDirectory/refreshGameDirectory'
import { updateProfileHandler } from './routes/profile/editProfile'
import { moveGameDirectoryFileHandler } from './routes/gameDirectory/moveGameDirectoryFile'
import { mkdirGameDirectoryFileHandler } from './routes/gameDirectory/mkdirGameDirectoryFile'
import { importProfilesHandler } from './routes/profile/importProfiles'

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

    router.registerRoute('post', '/profile', createProfileHandler(router))
    router.registerRoute(
        'patch',
        '/profile/:profile_id',
        updateProfileHandler(router)
    )
    router.registerRoute(
        'delete',
        '/profile/:profile_id',
        deleteProfileHandler(router)
    )
    router.registerRoute(
        'post',
        '/profile/import',
        importProfilesHandler(router)
    )
    router.registerRoute('get', '/profiles', getProfilesHandler(router))

    router.registerRoute('get', '/gameDirectories', getGameDirectories(router))
    router.registerRoute(
        'post',
        '/gameDirectory',
        createGameDirectoryHandler(router)
    )
    router.registerRoute(
        'delete',
        '/gameDirectory/:game_directory',
        deleteGameDirectoryHandler(router)
    )
    router.registerRoute(
        'get',
        '/gameDirectory/:game_directory/files',
        getGameDirectoryFilesHandler(router)
    )
    router.registerRoute(
        'delete',
        '/gameDirectory/:game_directory/file',
        deleteGameDirectoryFileHandler(router)
    )
    router.registerRoute(
        'post',
        '/gameDirectory/:game_directory/file',
        uploadGameDirectoryFileHandler(router)
    )
    router.registerRoute(
        'post',
        '/gameDirectory/:game_directory/mkdir',
        mkdirGameDirectoryFileHandler(router)
    )
    router.registerRoute(
        'post',
        '/gameDirectory/:game_directory/move',
        moveGameDirectoryFileHandler(router)
    )
    router.registerRoute(
        'post',
        '/gameDirectory/:game_directory/refresh',
        refreshGameDirectoryHandler(router)
    )

    router.registerRoute(
        'get',
        '/getMinecraftVersions',
        getMinecraftVersionHandler(router)
    )

    return router
}
export type APIRouter = ReturnType<typeof createRouter>
