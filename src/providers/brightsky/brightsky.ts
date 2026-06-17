import { Station, MeasurementCollection } from '../types';
import { WeatherProvider } from '../WeatherProvider';
import stationsRegistry from './stations.json';
import { logger } from '../../logger';
import { getShortTitleFromApiKey, getShortUnitFromApiKey, getApiKeyFromShortTitle } from './utils';
import brightskyParams from './parameters.json';

export class BrightskyProvider extends WeatherProvider {
    readonly name = 'brightsky';
    private readonly baseUrl = 'https://api.brightsky.dev/current_weather';
    
    // Explicitly track keys we expect to process from our configuration JSON
    private readonly supportedApiKeys = brightskyParams.map(p => p.key);

    /**
     * Prepares all stations from the local registry for provisioning.
     * Maps available API phenomena back to standardized internal parameters.
     */
    protected async collectStations(): Promise<Station[]> {
        const preparedStations: Station[] = [];

        for (const station of stationsRegistry) {
            try {
                const response = await fetch(`${this.baseUrl}?dwd_station_id=${station.stationID}`);
                if (!response.ok) continue;

                const { weather } = (await response.json()) as {
                    weather: Record<string, unknown>;
                };

                if (!weather) continue;

                // Restrict mapping down exclusively to things present in our parameters config array
                const phenomenaKeys = Object.keys(weather).filter(key =>
                    this.supportedApiKeys.includes(key) &&
                    weather[key] !== null && 
                    weather[key] !== undefined &&
                    !isNaN(Number(weather[key]))
                );

                if (phenomenaKeys.length === 0) continue;

                preparedStations.push({
                    stationID: station.stationID,
                    name: station.name,
                    latitude: Number(station.lat),
                    longitude: Number(station.lon),
                    provider: this.name,
                    phenomena: phenomenaKeys.map(key => ({
                        title: getShortTitleFromApiKey(key)!,
                        unit: getShortUnitFromApiKey(key)!
                    }))
                });

            } catch (err) {
                logger.error(`[Brightsky] Failed preparing station registry for ID ${station.stationID}:`, err);
            }
        }

        return preparedStations;
    }

    /**
     * Aggregates live weather data based on active mappings from the database.
     * Safely reads mapped parameters and parses raw API properties.
     */
    protected async collectMeasurements(activeMappings: any[]): Promise<MeasurementCollection[]> {
        const collections: MeasurementCollection[] = [];

        // Group database rows by externalStationId to minimize API requests
        const stationsMap = activeMappings.reduce((acc: Record<string, any[]>, row: any) => {
            if (!acc[row.externalStationId]) acc[row.externalStationId] = [];
            acc[row.externalStationId].push(row);
            return acc;
        }, {});

        for (const [stationId, mappings] of Object.entries(stationsMap) as [string, any[]][]) {
            try {
                const response = await fetch(`${this.baseUrl}?dwd_station_id=${stationId}`);
                if (!response.ok) continue;

                const data = await response.json();
                if (!data || !data.weather) continue;

                const weather = data.weather;
                const boxValuesMap: Record<string, { accessToken: string; values: any[] }> = {};

                for (const match of mappings) {
                    // Convert target database phenomenon name (e.g., 'air_temperature') to API payload key (e.g., 'temperature')
                    const apiKey = getApiKeyFromShortTitle(match.phenomenon);
                    if (!apiKey) continue;

                    const liveValue = weather[apiKey];

                    if (liveValue !== null && liveValue !== undefined && !isNaN(Number(liveValue))) {
                        if (!boxValuesMap[match.osemBoxId]) {
                            boxValuesMap[match.osemBoxId] = {
                                accessToken: match.accessToken || '',
                                values: []
                            };
                        }

                        boxValuesMap[match.osemBoxId].values.push({
                            sensor: match.osemSensorId,
                            value: String(liveValue),
                            createdAt: weather.timestamp
                        });
                    }
                }

                // Push successfully parsed boxes into the main results array
                for (const [osemBoxId, group] of Object.entries(boxValuesMap)) {
                    if (group.values.length === 0) continue;

                    collections.push({
                        osemBoxId,
                        accessToken: group.accessToken,
                        values: group.values
                    });
                }

            } catch (error) {
                logger.error(`[Brightsky] Failed collecting measurements for station ${stationId}:`, error);
            }
        }

        return collections;
    }
}