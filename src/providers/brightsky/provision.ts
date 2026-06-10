import { eq, and } from 'drizzle-orm';
import { weatherOsemMapping } from '../../db/schema';
import stationsRegistry from './stations.json';
import { logger } from '../../logger';
import { osemService } from '../../services/osem';

const PROVIDER_NAME = 'brightsky';

export async function provisionBrightsky(db: any) {
    const totalStations = stationsRegistry.length;
    let registeredStationsCount = 0;
    let processedCount = 0;

    for (const station of stationsRegistry) {
        processedCount++;
        const stationLogPrefix = `[Station ${station.stationID} - ${station.name}]`;

        try {
            const existing = await db.select()
                .from(weatherOsemMapping)
                .where(and(
                    eq(weatherOsemMapping.provider, PROVIDER_NAME),
                    eq(weatherOsemMapping.externalStationId, station.stationID)
                ));

            if (existing.length > 0) {
                logger.debug(`${stationLogPrefix} Already provisioned. Skipping.`);
                if (processedCount % 100 === 0 || processedCount === totalStations) {
                    logger.info(`${registeredStationsCount}/${totalStations} stations added`);
                }
                continue;
            }

            const response = await fetch(`https://api.brightsky.dev/current_weather?dwd_station_id=${station.stationID}`);
            if (!response.ok){
                logger.error(`${stationLogPrefix} API returned status ${response.status}. Skipping station.`);
                continue;
            }

            const data = await response.json();
            if (!data.weather) continue;

            const ignoredKeys = ['timestamp', 'icon', 'source_id'];
            const activePhenomena = Object.keys(data.weather).filter(key => 
                !ignoredKeys.includes(key) && data.weather[key] !== null && !isNaN(Number(data.weather[key]))
            );

            if(activePhenomena.length === 0) {
                logger.error(`${stationLogPrefix} No valid phenomena found. Skipping station.`);
                continue;
            }

            await osemService.createBox(db, station, PROVIDER_NAME, activePhenomena);

            registeredStationsCount++;
            logger.debug(`${stationLogPrefix} Successfully provisioned.`);

        } catch (err) {
            logger.error(`${stationLogPrefix} Error during provisioning:`, err);
        }

        if (processedCount % 100 === 0 || processedCount === totalStations) {
            logger.info(`${registeredStationsCount}/${totalStations} stations added`);
        }
    }
}