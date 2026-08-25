import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ DATABASE_URL is not defined');
  process.exit(1);
}

// Gunakan pg.Pool untuk koneksi
const pool = new pg.Pool({ connectionString, max: 1 });
const db = drizzle(pool);

console.log('📦 Running migrations...');
try {
  // Pastikan folder drizzle hasil dari `pnpm db:generate` ada di folder ini
  await migrate(db, { migrationsFolder: './drizzle' });
  console.log('✅ Migrations completed.');
} catch (error) {
  console.error('❌ Migration failed:', error);
  process.exit(1);
}

await pool.end();
