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
    is_neoforge: int({ mode: 'boolean' }).notNull().default(false),
    forge_version: text(),
    game_directory: text().references(() => gameDirectoriesTable.name),
    last_modified: int({ mode: 'timestamp_ms' }).notNull().default(new Date(0)),
    curseforge_profile_created_at: int({ mode: 'timestamp_ms' })
})

export const gameDirectoriesTable = sqliteTable('gameDirectories', {
    name: text().notNull().primaryKey(),
    last_modified: int({ mode: 'timestamp_ms' }).notNull().default(new Date(0)),
    tarball_created_at: int({ mode: 'timestamp_ms' })
})

export const filesTable = sqliteTable(
    'files',
    {
        game_directory: text()
            .notNull()
            .references(() => gameDirectoriesTable.name),
        filepath: text().notNull(),
        last_modified: int({ mode: 'timestamp_ms' }).notNull(),
        hash: text().notNull(),
        is_directory: int({ mode: 'boolean' }).notNull().default(false) // whether the file is a file or a directory, if it's a directory, hash is an empty string
    },
    table => [
        primaryKey({
            columns: [table.game_directory, table.filepath]
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
