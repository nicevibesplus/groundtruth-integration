import { stat } from 'node:fs';
import { weatherOsemMapping } from '../db/schema';
import { MeasurementCollection, Station } from '../providers/types';
import { logger } from '../logger';

const OSEM_API = process.env.API_URL || 'http://localhost:3000';
const OSEM_USERNAME = process.env.OSEM_USERNAME || '';
const OSEM_PASSWORD = process.env.OSEM_PASSWORD || '';

export const osemService = {

    async _addMatchTableEntry(
        db: any,
        provider: string,
        externalStationId: string,
        phenomenon: string,
        osemBoxId: string,
        osemSensorId: string,
        accessToken: string
    ) {
        await db.insert(weatherOsemMapping).values({
            provider: provider,
            externalStationId: externalStationId,
            phenomenon: phenomenon,
            osemBoxId: osemBoxId,
            osemSensorId: osemSensorId,
            accessToken: accessToken
        });
    },

    async createBox(
        db: any,
        station: Station
    ) {
        logger.debug(`Creating box ${station.name}`)
        const body = JSON.stringify({
                name: station.name,
                boxType: 'stationary',
                exposure: 'outdoor',
                grouptag: ['groundtruth-integration', station.provider],
                location: [Number(station.longitude), Number(station.latitude)],
                model: 'custom',
                sensors: station.phenomena.map(phenomenon => ({
                    title: phenomenon.title,
                    unit: phenomenon.unit,
                    sensorType: 'Unknown'
                }))
            });
        const response = await fetch(`${OSEM_API}/boxes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.OSEM_API_TOKEN}` },
            body: body
        })
        if (!response.ok) {
            throw new Error(`Failed to create OSeM Box. Status: ${response.status}`);
        }

        const osemBox = await response.json();
        for (const sensor of osemBox.sensors) {
            this._addMatchTableEntry(
                db,
                station.provider,
                station.stationID,
                sensor.title,
                osemBox._id,
                sensor._id,
                osemBox.access_token
            )
        }
    },

    async addNewSensorsToBox(
        db: any,
        station: Station,
        osem_box_id: string
    ) {
        logger.debug(`Adding sensors to ${station.name}.`)
        const response = await fetch(`${OSEM_API}/boxes/${osem_box_id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.OSEM_API_TOKEN}` },
            body: JSON.stringify({
                sensors: station.phenomena.map(phenomenon => ({
                    title: phenomenon.title,
                    unit: phenomenon.unit,
                    sensorType: 'Unknown'
                }))
            })
        })
        if (!response.ok) {
            throw new Error(`Failed to update OSeM Box. Status: ${response.status}`);
        }

        const osemBox = await response.json();
        for (const sensor of osemBox.sensors) {
            this._addMatchTableEntry(
                db,
                station.provider,
                station.stationID,
                sensor.title,
                osemBox._id,
                sensor._id,
                osemBox.access_token
            )
        }
    },

    async uploadMeasurementsOfStation(measurements: MeasurementCollection) {
        logger.debug(`Uploading measurements for ${measurements.osemBoxId}.`);
        const response = await fetch(`${OSEM_API}/boxes/${measurements.osemBoxId}/data`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `${measurements.accessToken}` },
            body: JSON.stringify(measurements.values)
        });

        if (!response.ok) {
            throw new Error(`Failed to upload measurements. Status: ${response.status}`);
        }
    },

    async signin() {
        logger.debug(`Signing in user ${OSEM_USERNAME} to receive access token.`)
        const response = await fetch(`${OSEM_API}/users/sign-in`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: OSEM_USERNAME,
                password: OSEM_PASSWORD
            })
        });
        if (!response.ok) {
            throw new Error(`Failed to sign-in user ${OSEM_USERNAME}. Status: ${response.status}`);
        }
        const data = await response.json();
        if (!data) {
            throw new Error(`Failed to sign-in user ${OSEM_USERNAME}. Status: ${response.status}`);
        }
        process.env.OSEM_API_TOKEN = data.token;
    }
};