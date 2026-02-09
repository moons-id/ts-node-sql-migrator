import type { NodeClickHouseClient } from "@clickhouse/client/dist/client";
import fs from "fs";
import { join } from "path";


export async function migrateResetCh(db: NodeClickHouseClient|null, scriptsDir: string, type: string) {
  if (!db) throw Error('Database connection is required')
  try {
    console.log(`Reverting database ${type}s...`);
    if (type === 'seed') {
      await db.exec({ query: "DROP TABLE IF EXISTS node_migrator_seeds" });
      console.log("✓ Seed cleaned");
      return;
    }

    const res = await db.query({
      query: `SELECT version FROM node_migrator_${type}s`,
      format: 'JSONEachRow',
    });

    const data = await res.json() as any;
    const versions = data.map((row: {version: string}) => row.version)

    const scripts: string[] = []
    const availableVersions: string[] = []

    const files = fs.readdirSync(scriptsDir)
      .filter((file) => {
        const isVersion =  versions.includes(file.split('_')[0])
        return isVersion && file.endsWith('.sql')
      }).sort().reverse()

    for (const file of files) {
      if (files.includes(file)) {
        scripts.push(file)
        availableVersions.push(file.split('_')[0] as string)
      }
    }

    if (scripts.length !== data.length) {
      const missingVersions = versions.filter((v: string) => !availableVersions.includes(v))
      throw Error(`Missing version: ${missingVersions}`)
    }

    for (const file of scripts) {
      const migrationPath = join(scriptsDir, file);
      const migrationScripts = fs.readFileSync(migrationPath, 'utf8');

      const sqls = migrationScripts.split('-- +migrator DOWN')[1] || ''
      const sql =  sqls?.split('-- +migrator UP')[0] || ''
      await db.exec({ query: sql });

      console.log(`✓ Migration ${file} reverted`);
    }

    await db.exec({ query: `DELETE FROM node_migrator_${type}s WHERE 1=1` })
    await db.exec({ query: "DROP TABLE IF EXISTS node_migrator_seeds" });
    console.log("Migrations rolled back");
  } catch (e) {
    console.error('Migration RESET failed: ', (e as Error).message);
    process.exit(1);
  }
}