import { eq } from 'drizzle-orm';
import { weatherOsemMapping } from '../../db/schema';
import { logger } from '../../logger';
import { osemService } from '../../services/osem';

const PROVIDER_NAME = 'brightsky';

export async function syncBrightsky(db: any) {
    
    const activeMappings = await db.select()
        .from(weatherOsemMapping)
        .where(eq(weatherOsemMapping.provider, PROVIDER_NAME));

    if (activeMappings.length === 0) return;

    const stationsMap = activeMappings.reduce((acc: Record<string, any[]>, row: any) => {
        if (!acc[row.externalStationId]) acc[row.externalStationId] = [];
        acc[row.externalStationId].push(row);
        return acc;
    }, {});

    const totalStations = Object.keys(stationsMap).length;
    logger.info(`Loading measurement from ${PROVIDER_NAME}`);

    let processedStationsCount = 0;
    let totalMeasurementsAdded = 0;

    for (const [stationId, mappings] of Object.entries(stationsMap) as [string, any[]][]) {
        try {
            const response = await fetch(`https://api.brightsky.dev/current_weather?dwd_station_id=${stationId}`);
            if (!response.ok) {
                logger.error(`[Station ${stationId}] API returned status ${response.status}`);
                continue;
            }

            const data = await response.json();
            if (!data.weather) continue;

            const weather = data.weather;
            const timestamp = new Date(weather.timestamp).toISOString();
            
            const boxUploads: Record<string, any[]> = {};
            const boxTokens: Record<string, string | null> = {};

            for (const match of mappings) {
                const liveValue = weather[match.phenomenon];

                if (liveValue !== null && liveValue !== undefined && !isNaN(Number(liveValue))) {
                    if (!boxUploads[match.osemBoxId]) {
                        boxUploads[match.osemBoxId] = [];
                        boxTokens[match.osemBoxId] = match.accessToken || null;
                    }
                    
                    boxUploads[match.osemBoxId].push({
                        sensor: match.osemSensorId,
                        value: Number(liveValue).toString(),
                        createdAt: timestamp
                    });
                }
            }

            for (const [boxId, payloads] of Object.entries(boxUploads)) {
                if (payloads.length === 0) continue;
                
                await osemService.uploadMeasurements(boxId, boxTokens[boxId], payloads);
                totalMeasurementsAdded += payloads.length;
            }

        } catch (error) {
            logger.error(`[Station ${stationId}] Error during sync:`, error);
        }

        processedStationsCount++;
        if (processedStationsCount % 100 === 0 || processedStationsCount === totalStations) {
            logger.info(`${processedStationsCount}/${totalStations} stations loaded, ${totalMeasurementsAdded} measurements added`);
        }
    }
}