import 'dotenv/config';
import cron from 'node-cron';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { providerRegistry } from './providers/registry';
import { logger } from './logger';
import { osemService } from './services/osem';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is missing.');

const username = process.env.USERNAME;
const password = process.env.PASSWORD;

const db = drizzle(postgres(databaseUrl));

function getTimestamp(): string {
    return new Date().toTimeString().split(' ')[0];
}

async function runSynchronizationSweep() {
    logger.info(`\nRunning Synchronizations at ${getTimestamp()}`);
    for (const provider of providerRegistry) {
        logger.info(`\nSynchronizing provider ${provider.name}...`);
        try {
            await provider.sync(db);
        } catch (err) {
            logger.error(`Failed execution sweep for provider ${provider.name}:`, err);
        }
    }
}
async function runProvisioningSweep() {
    logger.info(`\n--- Running Provider Provisioning & Schema Update Sweep ---`);
    await osemService.signin();
    for (const provider of providerRegistry) {
        try {
            await provider.provision(db);
        } catch (err) {
            logger.error(`Failed provisioning sweep for ${provider.name}:`, err);
        }
    }
}

async function main() {
    logger.debug('Starting Ground-Truth Integration Engine...');

    // Run once at startup to guarantee everything is matched up
    await runProvisioningSweep();

    // Cron 1: Every hour, look for station updates, new sensors, or brand new stations
    cron.schedule('0 * * * *', async () => {
        await runProvisioningSweep();
    });

    // Cron 2: Continuous measurement sync (your existing cron)
    cron.schedule('0,10,20,30,40,50 * * * *', async () => {
        await runSynchronizationSweep();
    });
}

main().catch((err) => {
    logger.error('Critical Microservice Boot Failure:', err);
    process.exit(1);
});