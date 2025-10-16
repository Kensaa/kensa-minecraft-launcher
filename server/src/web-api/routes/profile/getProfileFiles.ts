import { z } from 'zod'
import { APIRouter } from '../../web-api'
import { filesTable, profilesTable } from '../../../db/schema'
import { HTTPError } from 'express-api-router'
import { eq } from 'drizzle-orm'
import { buildFileTree, Tree } from '../../../utils'

const treeLeafSchema = z.object({
    lastModified: z.date(),
    hash: z.string()
})
type Leaf = z.output<typeof treeLeafSchema>
const treeSchema: z.ZodType<Tree<Leaf>> = z.lazy(() =>
    z.record(z.string(), z.union([treeSchema, treeLeafSchema]))
)
export function getProfileFilesHandler(router: APIRouter) {
    return router.createRouteHandler({
        authed: true,
        bodySchema: z.undefined(),
        paramsSchema: z.object({
            profile_id: z.string()
        }),
        querySchema: z.object(),
        responseSchema: treeSchema,
        async handler(req, res, instances, userTokenData) {
            const profile_id = parseInt(req.params.profile_id)
            if (Number.isNaN(profile_id))
                throw new HTTPError(400, 'invalid profile id')

            const profiles = await instances.database
                .select()
                .from(profilesTable)
                .where(eq(profilesTable.id, profile_id))

            if (profiles.length === 0)
                throw new HTTPError(404, 'profile not found')

            const profile = profiles[0]
            const files = await instances.database
                .select()
                .from(filesTable)
                .where(eq(filesTable.profile_id, profile.id))

            const tree = buildFileTree(files, file => ({
                lastModified: file.last_modified,
                hash: file.hash
            }))

            return tree
        }
    })
}
