import { Pool } from "pg";
import fs from "fs";
import { join } from "path";


export async function migrateDownPg(db: Pool|null, scriptsDir: string, type: string) {
  if (type === 'seed') {
    throw new Error("Seeder cannot be reverted. use 'reset' instead.")
  }

  if (!db) throw Error('Database connection is required')
  try {
    console.log(`Rolling back database ${type}s...`);
    const res = await db.query(`SELECT version FROM node_migrator_${type}s ORDER BY created_at DESC LIMIT 1`)
    const version = res.rows[0].version

    const file = fs.readdirSync(scriptsDir)
      .find((file) => file.startsWith(`${version}_`) && file.endsWith('.sql'))

    if (!file) throw Error(`Migration script version ${version} not found`)
    const migrationPath = join(scriptsDir, file);
    const migrationScripts = fs.readFileSync(migrationPath, 'utf8');

    const sqls = migrationScripts.split('-- +migrator DOWN')[1] || ''
    const sql =  sqls?.split('-- +migrator UP')[0] || ''
    await db.query(sql);

    await db.query(`DELETE FROM node_migrator_${type}s WHERE version = $1`, [version])
    console.log(`✓ Migration reverted: ${file}`);
  } catch (e) {
    console.error('Migration DOWN failed: ', (e as Error).message);
    process.exit(1);
  }
}