import { Station, MeasurementCollection } from '../types';
import { WeatherProvider } from '../WeatherProvider';
import { logger } from '../../logger';
import { getParameterName, getParameterUnit, getParameterIdByName, SmhiParameterConfig } from './utils';
import smhiMetadata from './parameters.json';

export class SmhiProvider extends WeatherProvider {
    readonly name = 'smhi';
    private readonly baseUrl = 'https://opendata-download-metobs.smhi.se/api/version/1.0';

    // Extract supported parameters directly from your local definition keys
    private readonly supportedParameterIds = (smhiMetadata as SmhiParameterConfig[]).map(p => p.key);

    protected async collectStations(): Promise<Station[]> {
        const stationMap: Record<string, Station> = {};

        for (const paramId of this.supportedParameterIds) {
            try {
                const response = await fetch(
                    `${this.baseUrl}/parameter/${paramId}/station-set/all/period/latest-hour/data.json`
                );
                if (!response.ok) continue;

                const data = await response.json();
                if (!data.station) continue;

                // Match with your curated schema values
                const phenomenonTitle = getParameterName(paramId);
                const phenomenonUnit = getParameterUnit(paramId);

                for (const smhiStation of data.station) {
                    // Exclude empty stations to protect OpenSenseMap creation mapping
                    if (!smhiStation.value || smhiStation.value.length === 0) continue;
                    if (!smhiStation.key || !smhiStation.latitude || !smhiStation.longitude) continue;

                    const stationId = String(smhiStation.key);

                    if (!stationMap[stationId]) {
                        stationMap[stationId] = {
                            stationID: stationId,
                            name: smhiStation.name || `SMHI Station ${stationId}`,
                            latitude: Number(smhiStation.latitude),
                            longitude: Number(smhiStation.longitude),
                            provider: this.name,
                            phenomena: []
                        };
                    }

                    if (!stationMap[stationId].phenomena.some(p => p.title === phenomenonTitle)) {
                        stationMap[stationId].phenomena.push({
                            title: phenomenonTitle,
                            unit: phenomenonUnit
                        });
                    }
                }
            } catch (err) {
                logger.error(`[SMHI] Failed gathering station data for parameter ID ${paramId}:`, err);
            }
        }

        return Object.values(stationMap);
    }

    protected async collectMeasurements(activeMappings: any[]): Promise<MeasurementCollection[]> {
        const collections: MeasurementCollection[] = [];
        const boxValuesMap: Record<string, { accessToken: string; values: any[] }> = {};

        if (activeMappings.length === 0) return [];

        const activePhenomena = [...new Set(activeMappings.map(m => m.phenomenon))];
        const activeParamIds = activePhenomena
            .map(name => getParameterIdByName(name))
            .filter((id): id is string => !!id);

        for (const paramId of activeParamIds) {
            try {
                const response = await fetch(
                    `${this.baseUrl}/parameter/${paramId}/station-set/all/period/latest-hour/data.json`
                );
                if (!response.ok) continue;

                const data = await response.json();
                if (!data.station) continue;

                const phenomenonName = getParameterName(paramId);

                for (const smhiStation of data.station) {
                    const stationId = String(smhiStation.key);

                    const matchingMappings = activeMappings.filter(
                        m => m.externalStationId === stationId && m.phenomenon === phenomenonName
                    );
                    if (matchingMappings.length === 0) continue;

                    // Exclude stations missing recent readings during synchronization cycle
                    if (!smhiStation.value || smhiStation.value.length === 0) continue;

                    const latestReading = smhiStation.value[0];
                    if (latestReading.value === undefined || latestReading.value === null) continue;

                    const timestamp = latestReading.date
                        ? new Date(latestReading.date).toISOString()
                        : new Date().toISOString();

                    for (const match of matchingMappings) {
                        if (!boxValuesMap[match.osemBoxId]) {
                            boxValuesMap[match.osemBoxId] = {
                                accessToken: match.accessToken || '',
                                values: []
                            };
                        }

                        boxValuesMap[match.osemBoxId].values.push({
                            sensor: match.osemSensorId,
                            value: String(latestReading.value),
                            createdAt: timestamp
                        });
                    }
                }
            } catch (err) {
                logger.error(`[SMHI] Error fetching live sync metrics for parameter ${paramId}:`, err);
            }
        }

        for (const [osemBoxId, group] of Object.entries(boxValuesMap)) {
            if (group.values.length === 0) continue;
            collections.push({
                osemBoxId,
                accessToken: group.accessToken,
                values: group.values
            });
        }

        return collections;
    }
}