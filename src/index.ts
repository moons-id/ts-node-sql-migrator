#!/usr/bin/env node

import fs from 'fs';
import {join} from 'path';
import {Pool} from "pg";
import 'dotenv/config'

function getArg(key: string, defaultValue = "") {
  const arg = process.argv.find((a) => a.startsWith(`--${key}=`));
  return arg ? arg.split("=")[1] : defaultValue;
}

async function runMigrations() {
  const action = getArg("action", "up");
  const driver = getArg("driver", "postgres");
  const type =  getArg("type", "migration");
  const name =  getArg("name", "");

  if (!['migration', 'seed'].includes(type)) {
    console.log('Invalid type. Please use "migration" or "seed".');
    process.exit(1);
  }
  if (action === 'new' && type === 'seed' && name === '') {
    console.log('Invalid name. Please use "new seed" following by name.');
    process.exit(1);
  }

  try {
    let pg: Pool | null = null;
    if (action !== 'new') {
      pg = new Pool({
        host: process.env.PG_HOST,
        port: Number(process.env.PG_PORT),
        password: process.env.PG_PASS,
        user: process.env.PG_USER,
        database: process.env.PG_DB,
      })

      await pg.query(`CREATE TABLE IF NOT EXISTS node_migrator_${type}s (
        id BIGSERIAL PRIMARY KEY,
        version VARCHAR(255) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW() 
      )`);
    }

    // @ts-ignore
    const scriptsDir = join(process.cwd(), 'db', driver, type === 'migration' ? 'migration' : 'seed');
    switch (action) {
      case 'up':
        await migrateUp(pg, scriptsDir, type);
        break;
      case 'down':
        await migrateDown(pg, scriptsDir, type);
        break;
      case 'reset':
        await migrateReset(pg, scriptsDir, type);
        break;
      case 'new':
        generateMigration(scriptsDir, name, type);
        break;
      default:
        console.log('Invalid action. Please use "up", "down", or "reset".');
        process.exit(1);
    }
  } catch (e) {
    console.error('Migration failed: ', (e as Error).message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

async function migrateUp(db: Pool|null, scriptsDir: string, type: string) {
  if (!db) throw Error('Database connection is required')
  try {
    console.log(`Pushing database ${type}s...`);
    const res = await db.query(`SELECT version FROM node_migrator_${type}s`)
    const versions = res.rows.map((row: {version: string}) => row.version)

    const files = fs.readdirSync(scriptsDir)
      .filter((file) => {
        const isVersion =  versions.includes(file.split('_')[0])
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

async function migrateDown(db: Pool|null, scriptsDir: string, type: string) {
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

async function migrateReset(db: Pool|null, scriptsDir: string, type: string) {
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
        const isVersion =  versions.includes(file.split('_')[0])
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
    console.error('Migration DOWN failed: ', (e as Error).message);
    process.exit(1);
  }
}

function generateMigration(scriptsDir: string, name: string, type: string) {
  if (name.length < 1) throw Error("name argument required")
  const timestamp = new Date().toISOString().replace(/\..+/, "").replace(/[^0-9]/g, "")
  const migrationPath = join(scriptsDir, `${timestamp}_${name}.sql`);

  if (!fs.existsSync(scriptsDir)) {
    fs.mkdirSync(scriptsDir, { recursive: true });
  }

  const migrationScripts = `-- +migrator UP
-- +migrator statement BEGIN

-- +migrator statement END


-- +migrator DOWN
-- +migrator statement BEGIN

-- +migrator statement END
`
  fs.writeFileSync(migrationPath, migrationScripts);

  console.log(`✓ ${type} created: ${timestamp}_${name}.sql`);
}

await runMigrations();