import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import path from 'path';
import { envDB } from './db/db.env-schema';

const migrationConnection = postgres(envDB.DATABASE_URL, {
  max: 5,
  ssl: envDB.PG_CLIENT_SSL,
  connect_timeout: 120,
});

async function main() {
  console.log('🔄 Migrations started...');
  
  // Resolve absolute path to the generated migrations folder
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