import {
    blob,
    int,
    primaryKey,
    sqliteTable,
    text
} from 'drizzle-orm/sqlite-core'

export const profilesTable = sqliteTable('profiles', {
    id: int().primaryKey({ autoIncrement: true }),
    name: text().notNull().unique(),
    mc_version: text().notNull(),
    forge_version: text(),
    game_directory: text()
})

export const filesTable = sqliteTable(
    'files',
    {
        profile_id: int()
            .notNull()
            .references(() => profilesTable.id),
        filepath: text().notNull(),
        last_modified: int({ mode: 'timestamp' }).notNull(),
        hash: text().notNull()
    },
    table => [
        primaryKey({
            columns: [table.profile_id, table.filepath]
        })
    ]
)

export const accountsTable = sqliteTable('accounts', {
    id: int().primaryKey({ autoIncrement: true }),
    username: text().notNull().unique(),
    hash: blob({ mode: 'buffer' }).notNull(),
    salt: blob({ mode: 'buffer' }).notNull(),

    temp_account: int({ mode: 'boolean' }).notNull(),
    is_admin: int({ mode: 'boolean' }).notNull().default(false)
})
