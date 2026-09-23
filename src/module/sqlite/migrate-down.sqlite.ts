import Database from "better-sqlite3";
import fs from "fs";
import { join } from "path";


export async function migrateDownSqlite(db: Database.Database | null, scriptsDir: string, type: string) {
  if (type === 'seed') {
    throw new Error("Seeder cannot be reverted. use 'reset' instead.")
  }

  if (!db) throw Error('Database connection is required')
  try {
    console.log(`Rolling back database ${type}s...`);
    const row = db.prepare(`SELECT version FROM node_migrator_${type}s ORDER BY created_at DESC LIMIT 1`).get() as { version: string } | undefined
    if (!row) throw Error('No migration to revert')
    const version = row.version

    const file = fs.readdirSync(scriptsDir)
      .find((file) => file.startsWith(`${version}_`) && file.endsWith('.sql'))

    if (!file) throw Error(`Migration script version ${version} not found`)
    const migrationPath = join(scriptsDir, file);
    const migrationScripts = fs.readFileSync(migrationPath, 'utf8');

    const sqls = migrationScripts.split('-- +migrator DOWN')[1] || ''
    const sql = sqls?.split('-- +migrator UP')[0] || ''
    db.exec(sql);

    db.prepare(`DELETE FROM node_migrator_${type}s WHERE version = ?`).run(version)
    console.log(`✓ Migration reverted: ${file}`);
  } catch (e) {
    console.error('Migration DOWN failed: ', (e as Error).message);
    process.exit(1);
  }
}
