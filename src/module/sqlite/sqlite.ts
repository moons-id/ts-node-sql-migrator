import Database from "better-sqlite3";
import { migrateUpSqlite } from "./migrate-up.sqlite.js";
import { migrateDownSqlite } from "./migrate-down.sqlite.js";
import { migrateResetSqlite } from "./migrate-reset.sqlite.js";
import { generateMigrationCommon } from "../common/generate-migration.common.js";
import { envConfig } from "../../config/config.js";
import { join } from "path";


export async function sqlite(type: string, action: string, name: string) {
  if (!['migration', 'seed'].includes(type)) {
    console.log('Invalid type. Please use "migration" or "seed".');
    process.exit(1);
  }
  if (action === 'new' && type === 'seed' && name === '') {
    console.log('Invalid name. Please use "new seed" following by name.');
    process.exit(1);
  }

  let db: Database.Database | null = null;
  try {
    if (action !== 'new') {
      db = new Database(envConfig.sqlite.path);
      db.exec(`CREATE TABLE IF NOT EXISTS node_migrator_${type}s (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        version TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`);
    }

    // @ts-ignore
    const scriptsDir = join(process.cwd(), 'db', 'sqlite', type === 'migration' ? 'migration' : 'seed');
    switch (action) {
      case 'up':
        await migrateUpSqlite(db, scriptsDir, type);
        break;
      case 'down':
        await migrateDownSqlite(db, scriptsDir, type);
        break;
      case 'reset':
        await migrateResetSqlite(db, scriptsDir, type);
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
    db?.close();
    process.exit(0);
  }
}
