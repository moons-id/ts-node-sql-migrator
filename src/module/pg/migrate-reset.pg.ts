import { Pool } from "pg";
import fs from "fs";
import { join } from "path";


export async function migrateResetPg(db: Pool|null, scriptsDir: string, type: string) {
  if (!db) throw Error('Database connection is required')
  try {
    console.log(`Reverting database ${type}s...`);
    if (type === 'seed') {
      await db.query("DROP TABLE IF EXISTS node_migrator_seeds");
      console.log("✓ Seed cleaned");
      return;
    }
    const res = await db.query(`SELECT version FROM node_migrator_${type}s`)
    const versions = res.rows.map((row: {version: string}) => row.version)
    const scripts: string[] = []
    const availableVersions: string[] = []

    const files = fs.readdirSync(scriptsDir)
      .filter((file) => {
        const isVersion =  versions.includes(file.split('_')[0] ?? '')
        return isVersion && file.endsWith('.sql')
      }).sort().reverse()

    for (const file of files) {
      if (files.includes(file)) {
        scripts.push(file)
        availableVersions.push(file.split('_')[0] as string)
      }
    }

    if (scripts.length !== res.rowCount) {
      const missingVersions = versions.filter((v: string) => !availableVersions.includes(v))
      throw Error(`Missing version: ${missingVersions}`)
    }

    for (const file of scripts) {
      const migrationPath = join(scriptsDir, file);
      const migrationScripts = fs.readFileSync(migrationPath, 'utf8');

      const sqls = migrationScripts.split('-- +migrator DOWN')[1] || ''
      const sql =  sqls?.split('-- +migrator UP')[0] || ''
      await db.query(sql);

      console.log(`✓ Migration ${file} reverted`);
    }

    await db.query(`DELETE FROM node_migrator_${type}s`)
    await db.query("DROP TABLE IF EXISTS node_migrator_seeds");
    console.log("Migrations rolled back");
  } catch (e) {
    console.error('Migration RESET failed: ', (e as Error).message);
    process.exit(1);
  }
}