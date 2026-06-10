import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import path from 'path';
import * as schema from './schema';

// 1. Ensure the DB connection string is present
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is missing.');
}

// 2. Initialize the Postgres.js client for querying
const queryClient = postgres(databaseUrl!, {
  idle_timeout: 30, 
  connect_timeout: 2,
});

// 3. Export the queryable Drizzle instance
export const db = drizzle(queryClient, { schema });

/**
 * Runs pending Drizzle migrations against the database on container boot.
 */
export async function runMigrations(): Promise<void> {
  console.log('🔄 Checking database for pending migrations...');
  
  try {
    // Postgres.js requires a dedicated connection with max: 1 for migrations
    const migrationClient = postgres(databaseUrl!, { max: 1 });
    const migrationDb = drizzle(migrationClient);

    const migrationsFolder = path.resolve(__dirname, '../../drizzle/migrations');
    
    await migrate(migrationDb, { migrationsFolder });
    
    console.log('✅ Database migrations applied successfully!');
    
    // Close the migration client when done
    await migrationClient.end();
  } catch (error) {
    console.error('❌ Failed to apply database migrations:', error);
    process.exit(1); 
  }
}