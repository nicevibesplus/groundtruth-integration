import { eq, and } from 'drizzle-orm';
import { weatherOsemMapping } from '../../db/schema';
import stationsRegistry from './stations.json';
import { logger } from '../../logger';
import { osemService } from '../../services/osem';

const PROVIDER_NAME = 'brightsky';

export async function provisionBrightsky(db: any) {
    const totalStations = stationsRegistry.length; // found
    let alreadyExistCount = 0;
    let registeredStationsCount = 0; // added
    let failedStationsCount = 0; // failed to add
    let processedCount = 0;

    for (const station of stationsRegistry) {
        processedCount++;
        const stationLogPrefix = `[Station ${station.stationID} - ${station.name}]`;

        // Fortschrittsanzeige: Ein Punkt alle 50 Stationen
        if (processedCount % 50 === 0) {
            process.stdout.write('.');
        }

        try {
            const existing = await db.select()
                .from(weatherOsemMapping)
                .where(and(
                    eq(weatherOsemMapping.provider, PROVIDER_NAME),
                    eq(weatherOsemMapping.externalStationId, station.stationID)
                ));

            if (existing.length > 0) {
                logger.debug(`${stationLogPrefix} Already provisioned. Skipping.`);
                alreadyExistCount++;
                continue;
            }

            const response = await fetch(`https://api.brightsky.dev/current_weather?dwd_station_id=${station.stationID}`);
            if (!response.ok){
                logger.debug(`${stationLogPrefix} API returned status ${response.status}. Skipping station.`);
                failedStationsCount++;
                continue;
            }

            const data = await response.json();
            if (!data.weather) {
                logger.debug(`${stationLogPrefix} Missing weather data in API response. Skipping station.`);
                failedStationsCount++;
                continue;
            }

            const ignoredKeys = ['timestamp', 'icon', 'source_id'];
            const activePhenomena = Object.keys(data.weather).filter(key => 
                !ignoredKeys.includes(key) && data.weather[key] !== null && !isNaN(Number(data.weather[key]))
            );

            if(activePhenomena.length === 0) {
                logger.debug(`${stationLogPrefix} No valid phenomena found. Skipping station.`);
                failedStationsCount++;
                continue;
            }

            await osemService.createBox(db, station, PROVIDER_NAME, activePhenomena);

            registeredStationsCount++;
            logger.debug(`${stationLogPrefix} Successfully provisioned.`);

        } catch (err) {
            logger.error(`${stationLogPrefix} Error during provisioning:`, err);
            failedStationsCount++;
        }
    }

    // Zeilenumbruch nach den Punkten, falls welche gedruckt wurden
    if (processedCount >= 50) {
        process.stdout.write('\n');
    }

    // Berechnung für die versuchten Neuanlagen
    const triedToAddCount = totalStations - alreadyExistCount;

    // Das detaillierte finale Log
    logger.info(
        `(found: ${totalStations}, already exist: ${alreadyExistCount}, tried to add: ${triedToAddCount}, added: ${registeredStationsCount}, failed to add: ${failedStationsCount})`
    );
}