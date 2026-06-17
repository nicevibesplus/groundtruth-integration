import { eq, and } from 'drizzle-orm';
import { weatherOsemMapping } from '../db/schema';
import { logger } from '../logger';
import { osemService } from '../services/osem';
import { Station, MeasurementCollection } from './types';


export abstract class WeatherProvider {
    abstract readonly name: string;

    protected abstract collectStations(activeMappings: any[]): Promise<Station[]>;
    protected abstract collectMeasurements(activeMappings: any[]): Promise<MeasurementCollection[]>;

    async provision(db: any): Promise<void> {
        logger.info(`[${this.name.toUpperCase()}] Provision started.`);
        const activeMappings = await db.select()
            .from(weatherOsemMapping)
            .where(eq(weatherOsemMapping.provider, this.name));

        const currentStations = await this.collectStations(activeMappings);

        var boxesCreated = 0;
        var boxesUpdated = 0;
        for (const station of currentStations) {
            try {
                const activeSensors = activeMappings.filter(
                    (m: any) => m.externalStationId === station.stationID
                );
                if (activeSensors.length === 0) {
                    await osemService.createBox(db, station);
                    boxesCreated++;
                } else {
                    station.phenomena = station.phenomena.filter(p => {
                        !activeSensors.map((m: any) => m.phenomenon).includes(p.title)
                    })

                    if (station.phenomena.length > 0) {
                        await osemService.addNewSensorsToBox(db, station, activeSensors[0].osem_box_id);
                        boxesUpdated++;
                    }
                }
            } catch (err) {
                logger.error(`[${this.name}] Failed processing provision sweep for station ${station.stationID}:`, err);
            }
        }
        logger.info(`[${this.name.toUpperCase()}] Created ${boxesCreated} new boxes, updated ${boxesUpdated} boxes.`)
        logger.info(`[${this.name.toUpperCase()}] Provision finished.`);
    }

    /** Centralized Syncing Logic (Stays beautifully generic and clean) */
    async sync(db: any): Promise<void> {
        logger.info(`[${this.name.toUpperCase()}] Syncronisation started.`);
        const activeMappings = await db.select()
            .from(weatherOsemMapping)
            .where(eq(weatherOsemMapping.provider, this.name));

        if (activeMappings.length === 0) return;

        const measurements = await this.collectMeasurements(activeMappings);
        var measurementsPushed = 0;
        for (const meas of measurements) {
            await osemService.uploadMeasurementsOfStation(meas);
            measurementsPushed++;
        }
        logger.info(`[${this.name.toUpperCase()}] Pushed measurements for ${measurementsPushed} boxes.`)
        logger.info(`[${this.name.toUpperCase()}] Syncronisation finished.`);
    }
}