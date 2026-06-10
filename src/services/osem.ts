import { weatherOsemMapping } from '../db/schema';
import { getUnit } from '../providers/brightsky/utils';

const OSEM_API = process.env.API_URL || 'http://localhost:3000';
const OSEM_API_TOKEN = process.env.OSEM_API_TOKEN || '';

export interface OsemPayload {
    sensor: string;
    value: string;
    createdAt: string;
}

export const osemService = {
    async createBox(
        db: any,
        station: { stationID: string; name: string; lon: number; lat: number },
        providerName: string,
        phenomena: string[]
    ) {
        const sensors = phenomena.map((phenomenon, index) => ({
            id: index.toString(),
            title: phenomenon,
            unit: getUnit(phenomenon),
            sensorType: 'Automated Weather Station'
        }));

        const response = await fetch(`${OSEM_API}/boxes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OSEM_API_TOKEN}` },
            body: JSON.stringify({
                name: station.name,
                boxType: 'stationary',
                exposure: 'outdoor',
                grouptag: ['GroundTruthIntegration', providerName],
                location: [Number(station.lon), Number(station.lat)],
                model: 'custom',
                sensors
            })
        });

        if (!response.ok) {
            throw new Error(`Failed to create OSeM Box. Status: ${response.status}`);
        }

        const osemBox = await response.json();

        for (const sensor of osemBox.sensors) {
            await db.insert(weatherOsemMapping).values({
                provider: providerName,
                externalStationId: station.stationID,
                phenomenon: sensor.title,
                osemBoxId: osemBox._id,
                osemSensorId: sensor._id,
                accessToken: osemBox.access_token
            });
        }

        return osemBox;
    },

    async uploadMeasurements(boxId: string, accessToken: string | null, payloads: OsemPayload[]) {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (accessToken) {
            headers['Authorization'] = `${accessToken}`;
        }

        const response = await fetch(`${OSEM_API}/boxes/${boxId}/data`, {
            method: 'POST',
            headers,
            body: JSON.stringify(payloads)
        });

        if (!response.ok) {
            throw new Error(`Failed to upload measurements. Status: ${response.status}`);
        }
    }
};