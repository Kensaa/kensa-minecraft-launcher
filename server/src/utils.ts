import { eq } from 'drizzle-orm'
import { filesTable, profilesTable } from './db/schema'
import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { pbkdf2Sync } from 'crypto'

export type Database = BetterSQLite3Database<Record<string, never>>
export async function getProfile(
    db: Database,
    profile_id: typeof profilesTable.$inferSelect.id
): Promise<typeof profilesTable.$inferSelect | undefined> {
    const profiles = await db
        .select()
        .from(profilesTable)
        .where(eq(profilesTable.id, profile_id))
    if (profiles.length == 0) return undefined
    return profiles[0]
}
export interface Tree {
    [key: string]: Tree | string
}
/**
 * Creates a recursive object representing the gameDirectory of a profile as a tree
 * @param files the files of the profile (from the database)
 * @returns the profile's file tree
 */
export function buildFileTree(files: (typeof filesTable.$inferSelect)[]): Tree {
    const tree: Tree = {}

    for (const file of files) {
        const parts = file.filepath.split('/')
        let curr = tree
        const filename = parts.pop()!
        for (const part of parts) {
            if (curr[part] === undefined) curr[part] = {}
            curr = curr[part] as Tree
        }
        curr[filename] = file.hash
    }
    return tree
}

export function hashPassword(password: Buffer, salt: Buffer): Buffer {
    return pbkdf2Sync(password, salt, 10000, 64, 'sha256')
}
