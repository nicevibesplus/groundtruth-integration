import { provisionBrightsky } from './brightsky/provision';
import { syncBrightsky } from './brightsky/sync';

// Define a strict schema for your Weather Providers
export interface WeatherProvider {
    name: string;
    provision: (db: any) => Promise<void>;
    sync: (db: any) => Promise<void>;
}

// Global registry lookup array
export const providerRegistry: WeatherProvider[] = [
    {
        name: 'brightsky',
        provision: provisionBrightsky,
        sync: syncBrightsky,
    },
    /*
    {
        name: 'openweather',
        provision: provisionOpenWeather,
        sync: syncOpenWeather,
    }
    */
];