import { z } from 'zod'
import type { APIRouter } from '../../web-api'
import { accountsTable } from '../../../db/schema'
import { eq } from 'drizzle-orm'
import crypto from 'crypto'
import { HTTPError } from 'express-api-router'
import jwt from 'jsonwebtoken'
import { hashPassword } from '../../../utils'

export function loginHandler(router: APIRouter) {
    return router.createRouteHandler({
        authed: false,
        bodySchema: z.object({
            username: z.string(),
            password: z.string()
        }),
        querySchema: z.object(),
        paramsSchema: z.object(),
        responseSchema: z.object({
            id: z.number(),
            username: z.string(),
            temp_account: z.boolean(),
            is_admin: z.boolean()
        }),
        async handler(req, res, instances) {
            const accounts = await instances.database
                .select()
                .from(accountsTable)
                .where(eq(accountsTable.username, req.body.username))

            if (accounts.length === 0)
                throw new HTTPError(404, 'account not found')

            const account = accounts[0]

            const hash = hashPassword(
                Buffer.from(req.body.password, 'utf-8'),
                account.salt
            )

            if (!crypto.timingSafeEqual(hash, account.hash)) {
                throw new HTTPError(401, 'wrong password')
            }

            const token = jwt.sign(
                {
                    id: account.id,
                    username: account.username,
                    is_admin: account.is_admin
                },
                instances.authSecret
            )

            const { hash: _, salt, ...strippedAccount } = account

            res.cookie('auth-token', token, {
                httpOnly: true,
                secure: true,
                maxAge: 1000 * 60 * 60 * 6 // 6h
                // add domain
            })

            return strippedAccount
        }
    })
}
