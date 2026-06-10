import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import path from 'path';
import { fileURLToPath } from 'url'; // Added: Required to handle ESM paths
import { envDB } from './db/db.env-schema';

// Reconstruct __dirname for ES Modules compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const migrationConnection = postgres(envDB.DATABASE_URL, {
  max: 5,
  ssl: envDB.PG_CLIENT_SSL,
  connect_timeout: 120,
});

async function main() {
  console.log('🔄 Migrations started...');
  
  // Resolve absolute path safely using the new __dirname variable
  const migrationsFolder = path.resolve(__dirname, '../drizzle/migrations');

  await migrate(drizzle(migrationConnection), { migrationsFolder });
  await migrationConnection.end();
  
  console.log('✅ Migrations finished');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});