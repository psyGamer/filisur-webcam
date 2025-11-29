import knex from 'knex'

import logger from './logger.ts'

const debugMode = process.env.NODE_ENV == 'development'

const db = knex({
    client: 'better-sqlite3',
    connection: {
        filename: `${import.meta.dirname}/../../data/db.sqlite`
    },
    log: {
        error: (msg) => logger.error(msg),
        warn: (msg) => logger.warn(msg),
        debug: (msg) => logger.debug(msg),
        enableColors: true,
    },
    debug: debugMode,
    asyncStackTraces: debugMode,
})
export default db

declare module 'knex/types/tables' {
    interface Tables {

    }
}