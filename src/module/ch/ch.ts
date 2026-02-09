import { migrateUpCh } from "./migrate-up.ch.js";
import { migrateDownCh } from "./migrate-down.ch.js";
import { migrateResetCh } from "./migrate-reset.ch.js";
import { generateMigrationCommon } from "../common/generate-migration.common.js";
import { createClient } from "@clickhouse/client";
import { NodeClickHouseClient } from "@clickhouse/client/dist/client.js";
import { envConfig } from "../../config/config.js";
import { join } from "path";


export async function ch(type: string, action: string, name: string) {
  if (!['migration', 'seed'].includes(type)) {
    console.log('Invalid type. Please use "migration" or "seed".');
    process.exit(1);
  }
  if (action === 'new' && type === 'seed' && name === '') {
    console.log('Invalid name. Please use "new seed" following by name.');
    process.exit(1);
  }

  try {
    const client = createClient({
      url: `${envConfig.clickHouse.ssl ? "https" : "http"}://${envConfig.clickHouse.host}:${envConfig.clickHouse.port}`,
      username: envConfig.clickHouse.user,
      password: envConfig.clickHouse.pass,
      database: envConfig.clickHouse.database,
      request_timeout: 10_000,
    });
    if (action !== 'new') {
      await client.query({
        query: `
          CREATE TABLE IF NOT EXISTS node_migrator_${type}s (
            id Int64 PRIMARY KEY,
            version String NOT NULL,
            created_at DateTime('UTC') NOT NULL DEFAULT now()
          )`,
        format: 'JSONEachRow',
      });
    }

    // @ts-ignore
    const scriptsDir = join(process.cwd(), 'db', 'clickhouse', type === 'migration' ? 'migration' : 'seed');
    switch (action) {
      case 'up':
        await migrateUpCh(client, scriptsDir, type);
        break;
      case 'down':
        await migrateDownCh(client, scriptsDir, type);
        break;
      case 'reset':
        await migrateResetCh(client, scriptsDir, type);
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