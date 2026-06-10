import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import path from 'path';
import * as schema from './schema';

// 1. Ensure the DB connection string is present
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is missing.');
}

// 2. Initialize the Postgres connection pool
const pool = new Pool({
  connectionString: databaseUrl,
  // Automatically close idle connections to keep Postgres happy
  idleTimeoutMillis: 30000, 
  connectionTimeoutMillis: 2000,
});

// 3. Export the queryable Drizzle instance (typed with your schema)
export const db = drizzle(pool, { schema });

/**
 * Runs pending Drizzle migrations against the database on container boot.
 * This ensures your custom tables are created automatically before the script runs.
 */
export async function runMigrations(): Promise<void> {
  console.log('🔄 Checking database for pending migrations...');
  
  try {
    // Resolve the path to the auto-generated migration folder
    const migrationsFolder = path.resolve(__dirname, '../../drizzle/migrations');
    
    // This looks at your migrations folder and applies any unrun SQL files
    await migrate(db, { migrationsFolder });
    
    console.log('✅ Database migrations applied successfully!');
  } catch (error) {
    console.error('❌ Failed to apply database migrations:', error);
    // Crash the container intentionally so Docker/Kubernetes knows something is wrong
    process.exit(1); 
  }
}