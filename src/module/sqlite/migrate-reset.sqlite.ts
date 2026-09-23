import Database from "better-sqlite3";
import fs from "fs";
import { join } from "path";


export async function migrateResetSqlite(db: Database.Database | null, scriptsDir: string, type: string) {
  if (!db) throw Error('Database connection is required')
  try {
    console.log(`Reverting database ${type}s...`);
    if (type === 'seed') {
      db.exec("DROP TABLE IF EXISTS node_migrator_seeds");
      console.log("✓ Seed cleaned");
      return;
    }
    const rows = db.prepare(`SELECT version FROM node_migrator_${type}s`).all() as { version: string }[];
    const versions = rows.map((row) => row.version)
    const scripts: string[] = []
    const availableVersions: string[] = []

    const files = fs.readdirSync(scriptsDir)
      .filter((file) => {
        const isVersion = versions.includes(file.split('_')[0] ?? '')
        return isVersion && file.endsWith('.sql')
      }).sort().reverse()

    for (const file of files) {
      if (files.includes(file)) {
        scripts.push(file)
        availableVersions.push(file.split('_')[0] as string)
      }
    }

    if (scripts.length !== versions.length) {
      const missingVersions = versions.filter((v: string) => !availableVersions.includes(v))
      throw Error(`Missing version: ${missingVersions}`)
    }

    for (const file of scripts) {
      const migrationPath = join(scriptsDir, file);
      const migrationScripts = fs.readFileSync(migrationPath, 'utf8');

      const sqls = migrationScripts.split('-- +migrator DOWN')[1] || ''
      const sql = sqls?.split('-- +migrator UP')[0] || ''
      db.exec(sql);

      console.log(`✓ Migration ${file} reverted`);
    }

    db.exec(`DELETE FROM node_migrator_${type}s`)
    db.exec("DROP TABLE IF EXISTS node_migrator_seeds");
    console.log("Migrations rolled back");
  } catch (e) {
    console.error('Migration RESET failed: ', (e as Error).message);
    process.exit(1);
  }
}
