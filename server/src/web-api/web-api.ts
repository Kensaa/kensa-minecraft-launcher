import {
    APIRouter as BaseApiRouter,
    createJWTAuthHandler
} from 'express-api-router'
import { Database } from '../utils'
import { loginHandler } from './routes/account/login'
import { registerHandler } from './routes/account/register'
import { meHandler } from './routes/account/me'
import { logoutHandler } from './routes/account/logout'
import cookieParser from 'cookie-parser'

export interface APIInstances {
    database: Database
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

    return router
}
export type APIRouter = ReturnType<typeof createRouter>
