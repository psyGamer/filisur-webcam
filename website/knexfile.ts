import type { Knex } from "knex"

const config: { [key: string]: Knex.Config } = {
    development: {
        client: 'better-sqlite3',
        connection: {
            filename: '../data/dev.sqlite3',
        },
        useNullAsDefault: true,
    },

    production: {
        client: 'postgresql',
        connection: {
            filename: '../data/prod.sqlite3'
        },
        useNullAsDefault: true,
        pool: {
            min: 2,
            max: 10
        },
        migrations: {
            tableName: 'knex_migrations',
        },
    }
}

export default config
