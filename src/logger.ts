// logger.ts
const LOG_LEVELS = { debug: 0, info: 1, error: 2 };
type LogLevel = keyof typeof LOG_LEVELS;

const CURRENT_LOG_LEVEL: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';

export const logger = {
    debug: (...args: any[]) => {
        if (LOG_LEVELS[CURRENT_LOG_LEVEL] <= LOG_LEVELS.debug) {
            console.log('🔍 [DEBUG]', ...args);
        }
    },
    info: (...args: any[]) => {
        if (LOG_LEVELS[CURRENT_LOG_LEVEL] <= LOG_LEVELS.info) {
            console.log(...args);
        }
    },
    error: (...args: any[]) => {
        if (LOG_LEVELS[CURRENT_LOG_LEVEL] <= LOG_LEVELS.error) {
            console.error('❌', ...args);
        }
    }
};