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

    const totalStations = Object.keys(stationsMap).length; // found
    logger.debug(`Loading measurements from ${PROVIDER_NAME}`);

    let processedStationsCount = 0;
    let successfulStationsCount = 0; // synced
    let failedStationsCount = 0;      // failed
    let totalMeasurementsAdded = 0;

    for (const [stationId, mappings] of Object.entries(stationsMap) as [string, any[]][]) {
        processedStationsCount++;

        // Fortschrittsanzeige: Ein Punkt alle 50 Stationen
        if (processedStationsCount % 50 === 0) {
            process.stdout.write('.');
        }

        try {
            const response = await fetch(`https://api.brightsky.dev/current_weather?dwd_station_id=${stationId}`);
            if (!response.ok) {
                logger.debug(`[Station ${stationId}] API returned status ${response.status}. Skipping.`);
                failedStationsCount++;
                continue;
            }

            const data = await response.json();
            if (!data.weather) {
                logger.debug(`[Station ${stationId}] Missing weather data in API response. Skipping.`);
                failedStationsCount++;
                continue;
            }

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

            let stationHasUploads = false;
            for (const [boxId, payloads] of Object.entries(boxUploads)) {
                if (payloads.length === 0) continue;
                
                await osemService.uploadMeasurements(boxId, boxTokens[boxId], payloads);
                totalMeasurementsAdded += payloads.length;
                stationHasUploads = true;
            }

            if (stationHasUploads) {
                successfulStationsCount++;
            } else {
                // Keine validen Werte für die Sensoren in dieser Station gefunden
                logger.debug(`[Station ${stationId}] No active phenomena values found to upload.`);
                failedStationsCount++;
            }

        } catch (error) {
            logger.error(`[Station ${stationId}] Error during sync:`, error);
            failedStationsCount++;
        }
    }

    // Zeilenumbruch nach den Punkten, falls welche gedruckt wurden
    if (processedStationsCount >= 50) {
        process.stdout.write('\n');
    }

    // Finale, detaillierte Auswertung
    logger.info(
        `(found stations: ${totalStations}, synced: ${successfulStationsCount}, failed: ${failedStationsCount}, measurements added: ${totalMeasurementsAdded})`
    );
}