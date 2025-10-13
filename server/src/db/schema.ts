import { int, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const profilesTable = sqliteTable('profiles', {
    id: int().primaryKey({ autoIncrement: true }),
    name: text().notNull(),
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
        last_modified: int().notNull(),
        hash: text().notNull()
    },
    table => [
        primaryKey({
            columns: [table.profile_id, table.filepath]
        })
    ]
)
