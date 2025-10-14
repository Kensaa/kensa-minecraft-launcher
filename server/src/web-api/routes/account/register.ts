import { z } from 'zod'
import type { APIRouter } from '../../web-api'
import { accountsTable } from '../../../db/schema'
import { eq } from 'drizzle-orm'
import { randomBytes } from 'crypto'
import { HTTPError } from 'express-api-router'
import jwt from 'jsonwebtoken'
import { hashPassword } from '../../../utils'

export function registerHandler(router: APIRouter) {
    return router.createRouteHandler({
        authed: true,
        bodySchema: z.object({
            username: z.string(),
            password: z.string(),
            isAdmin: z.boolean().default(false)
        }),
        querySchema: z.object(),
        paramsSchema: z.object(),
        responseSchema: z.object({
            id: z.number(),
            username: z.string(),
            temp_account: z.boolean(),
            is_admin: z.boolean()
        }),
        async handler(req, res, instances, userTokenData) {
            if (!userTokenData.is_admin)
                throw new HTTPError(
                    403,
                    "You don't have the permission to do that"
                )
            const accounts = await instances.database
                .select()
                .from(accountsTable)
                .where(eq(accountsTable.username, req.body.username))

            if (accounts.length !== 0)
                throw new HTTPError(409, 'account already exists')

            const salt = randomBytes(32)
            const password = Buffer.from(req.body.password, 'utf-8')
            const hash = hashPassword(password, salt)
            const { lastInsertRowid: accountID } = await instances.database
                .insert(accountsTable)
                .values({
                    hash,
                    salt,
                    temp_account: false,
                    is_admin: req.body.isAdmin,
                    username: req.body.username
                })

            const insertedAccount = (
                await instances.database
                    .select()
                    .from(accountsTable)
                    .where(eq(accountsTable.id, accountID as number))
            )[0]

            const token = jwt.sign(
                {
                    id: insertedAccount.id,
                    username: insertedAccount.username,
                    is_admin: insertedAccount.is_admin
                },
                instances.authSecret
            )

            const { hash: _, salt: __, ...strippedAccount } = insertedAccount

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
