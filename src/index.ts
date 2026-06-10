import 'dotenv/config';
import cron from 'node-cron';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import path from 'path';

import { providerRegistry } from './providers/registry';
import { logger } from './logger';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is missing.');

const db = drizzle(postgres(databaseUrl));

function getTimestamp(): string {
    return new Date().toTimeString().split(' ')[0];
}

async function runDatabaseMigrations() {
    logger.debug('[DB] Running migrations...');
    const migrationsFolder = path.resolve(__dirname, '../drizzle/migrations');
    const migrationClient = postgres(databaseUrl!, { max: 1 });
    await migrate(drizzle(migrationClient), { migrationsFolder });
    await migrationClient.end();
}

async function runSynchronizationSweep() {
    logger.info(`Running Job at ${getTimestamp()}`);
    for (const provider of providerRegistry) {
        try {
            await provider.sync(db);
        } catch (err) {
            logger.error(`Failed execution sweep for provider ${provider.name}:`, err);
        }
    }
}

async function main() {
    logger.debug('Starting Ground-Truth Integration Engine...');
    await runDatabaseMigrations();

    logger.debug('[Provision] Running provider setup sweeps...');
    for (const provider of providerRegistry) {
        try {
            logger.info(`Provisioning provider ${provider.name}...`);
            await provider.provision(db);
        } catch (err) {
            logger.error(`Critical setup failure for provider ${provider.name}:`, err);
        }
    }

    cron.schedule('5,35 * * * *', async () => {
        await runSynchronizationSweep();
    });
}

main().catch((err) => {
    logger.error('Critical Microservice Boot Failure:', err);
    process.exit(1);
});