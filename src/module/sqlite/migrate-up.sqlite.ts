import Database from "better-sqlite3";
import fs from "fs";
import { join } from "path";


export async function migrateUpSqlite(db: Database.Database | null, scriptsDir: string, type: string) {
  if (!db) throw Error('Database connection is required')
  try {
    console.log(`Pushing database ${type}s...`);
    const rows = db.prepare(`SELECT version FROM node_migrator_${type}s`).all() as { version: string }[];
    const versions = rows.map((row) => row.version)

    const files = fs.readdirSync(scriptsDir)
      .filter((file) => {
        const isVersion = versions.includes(file.split('_')[0] ?? '')
        return !isVersion && file.endsWith('.sql')
      }).sort()

    for (const file of files) {
      const migrationPath = join(scriptsDir, file);
      const migrationScripts = fs.readFileSync(migrationPath, 'utf8');

      const sqls = migrationScripts.split('-- +migrator UP')[1] || ''
      const sql = sqls?.split('-- +migrator DOWN')[0] || ''
      db.exec(sql);

      const version = file.split('_')[0]
      db.prepare(`INSERT INTO node_migrator_${type}s (version) VALUES (?)`).run(version)
      console.log(`✓ Migration pushed: ${file}`);
    }

    console.log(`All ${type}s pushed successfully!`);
  } catch (e) {
    console.error('Migration UP failed: ', (e as Error).message);
    process.exit(1);
  }
}
