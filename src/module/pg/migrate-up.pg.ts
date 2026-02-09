import { Pool } from "pg";
import fs from "fs";
import { join } from "path";


export async function migrateUpPg(db: Pool|null, scriptsDir: string, type: string) {
  if (!db) throw Error('Database connection is required')
  try {
    console.log(`Pushing database ${type}s...`);
    const res = await db.query(`SELECT version FROM node_migrator_${type}s`)
    const versions = res.rows.map((row: {version: string}) => row.version)

    const files = fs.readdirSync(scriptsDir)
      .filter((file) => {
        const isVersion =  versions.includes(file.split('_')[0] ?? '')
        return !isVersion && file.endsWith('.sql')
      }).sort()

    for (const file of files) {
      const migrationPath = join(scriptsDir, file);
      const migrationScripts = fs.readFileSync(migrationPath, 'utf8');

      const sqls = migrationScripts.split('-- +migrator UP')[1] || ''
      const sql =  sqls?.split('-- +migrator DOWN')[0] || ''
      await db.query(sql);

      const version = file.split('_')[0]
      await db.query(`INSERT INTO node_migrator_${type}s (version) VALUES ($1)`, [version])
      console.log(`✓ Migration pushed: ${file}`);
    }

    console.log(`All ${type}s pushed successfully!`);
  } catch (e) {
    console.error('Migration UP failed: ', (e as Error).message);
    process.exit(1);
  }
}