#!/usr/bin/env node

import 'dotenv/config'
import { pg } from "./module/pg/pg.js";
import { ch } from "./module/ch/ch.js";
import { loadVaultConfig } from "./config/config.js";


function getArg(key: string, defaultValue = "") {
  const arg = process.argv.find((a) => a.startsWith(`--${key}=`));
  return arg ? arg.split("=")[1] : defaultValue;
}

async function runMigrations() {
  await loadVaultConfig()

  const action = getArg("action", "up") ?? "up";
  const driver = getArg("driver", "postgres") ?? "";
  const type = getArg("type", "migration") ?? "migration";
  const name = getArg("name", "") ?? "";

  switch (driver) {
    case "clickhouse":
      await ch(type, action, name);
      break;
    case "postgres":
      await pg(type, action, name);
      break;
    default:
      await ch(type, action, name);
      await pg(type, action, name);
      break;
  }
}

await runMigrations();