import { db } from './db';
import { readdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const MIGRATIONS_DIR = join(__dirname, 'migrations');

export function runMigrations() {
  console.log('Running database migrations...');

  // Get all .sql files in migrations directory
  const migrationFiles = readdirSync(MIGRATIONS_DIR)
    .filter(file => file.endsWith('.sql'))
    .sort();

  // Check which migrations have already been applied
  const appliedMigrations = db
    .prepare('SELECT name FROM migrations')
    .all()
    .map((row: any) => row.name);

  let appliedCount = 0;

  // Run pending migrations
  for (const file of migrationFiles) {
    if (appliedMigrations.includes(file)) {
      console.log(`  ✓ ${file} (already applied)`);
      continue;
    }

    console.log(`  → Applying ${file}...`);

    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf-8');

    try {
      db.exec(sql);

      // Record migration as applied
      db.prepare('INSERT INTO migrations (name, applied_at) VALUES (?, ?)').run(
        file,
        new Date().toISOString()
      );

      console.log(`  ✓ ${file} applied successfully`);
      appliedCount++;
    } catch (error) {
      console.error(`  ✗ Failed to apply ${file}:`, error);
      throw error;
    }
  }

  if (appliedCount === 0) {
    console.log('All migrations up to date.');
  } else {
    console.log(`Applied ${appliedCount} migration(s).`);
  }
}
