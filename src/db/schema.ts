import { pgTable, uuid, varchar, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

export const weatherOsemMapping = pgTable('weather_osem_match', {
  id: uuid('id').defaultRandom().primaryKey(),
  
  // Identifies which driver to route this to (e.g., 'brightsky', 'openweather')
  provider: varchar('provider', { length: 50 }).notNull(),
  
  // Universal string representation of the foreign service's station identity
  externalStationId: varchar('external_station_id', { length: 50 }).notNull(),
  
  // The universal key identifying the metric (e.g., 'temperature', 'relative_humidity')
  phenomenon: varchar('phenomenon', { length: 50 }).notNull(),

  // Destination targets inside openSenseMap
  osemBoxId: varchar('osem_box_id', { length: 24 }).notNull(),
  osemSensorId: varchar('osem_sensor_id', { length: 24 }).notNull(),
  accessToken: varchar('access_token', { length: 255 }).notNull(),

  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  // Prevent duplicate mapping rows for the exact same station metric point
  uniqueIndex('provider_station_phenomenon_idx').on(
    table.provider, 
    table.externalStationId, 
    table.phenomenon
  )
]);