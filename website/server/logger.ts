import { createLogger, format, transports } from 'winston';

const logger = createLogger({
    level: 'debug',
    transports: [
        new transports.Console({
            format: format.combine(
                format.colorize(),
                format.simple(),
            ),
        }),
        new transports.File({ 
            filename: 'debug.log',
            format: format.combine(
                format.prettyPrint(),
                format.timestamp({ format: 'DD-MM-YYYY HH:mm:ss' }),
                format.printf(nfo => `${nfo.timestamp} - ${nfo.level}: ${nfo.message}`),
            ),
        }),
    ],
});

export default logger