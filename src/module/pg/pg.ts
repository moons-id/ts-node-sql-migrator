import type { PoolConfig } from "pg";
import { Pool } from "pg";
import { migrateUpPg } from "./migrate-up.pg.js";
import { migrateDownPg } from "./migrate-down.pg.js";
import { migrateResetPg } from "./migrate-reset.pg.js";
import { generateMigrationCommon } from "../common/generate-migration.common.js";
import { envConfig } from "../../config/config.js";


export async function pg(type: string, action: string, name: string) {
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
      const pgConfig: PoolConfig = {
        host: envConfig.pg.host,
        port: envConfig.pg.port,
        password: envConfig.pg.password,
        user: envConfig.pg.user,
        database: envConfig.pg.database,
      }

      if (process.env.PG_CA?.length) {
        pgConfig.ssl = { ca: process.env.PG_CA }
      }

      pg = new Pool(pgConfig)
      await pg.query(`CREATE TABLE IF NOT EXISTS node_migrator_${type}s (
        id BIGSERIAL PRIMARY KEY,
        version VARCHAR(255) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW() 
      )`);
    }

    // @ts-ignore
    const scriptsDir = join(process.cwd(), 'db', 'postgres', type === 'migration' ? 'migration' : 'seed');
    switch (action) {
      case 'up':
        await migrateUpPg(pg, scriptsDir, type);
        break;
      case 'down':
        await migrateDownPg(pg, scriptsDir, type);
        break;
      case 'reset':
        await migrateResetPg(pg, scriptsDir, type);
        break;
      case 'new':
        generateMigrationCommon(scriptsDir, name, type);
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