import dotenv from 'dotenv';
import vaultClient from 'node-vault-client';

dotenv.config();

type EnvConfig = {
  pg: PgConfig;
  clickHouse: ClickHouseConfig;
}

type PgConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  queryTimeout: number;
  connectionTimeout: number;
}

type ClickHouseConfig = {
  port: number;
  host: string;
  database: string;
  pass: string;
  user: string;
  ssl: boolean;
}

const pgConfig: PgConfig = {
  host: process.env.PG_HOST || 'localhost',
  port: Number(process.env.PG_PORT) || 5432,
  user: process.env.PG_USER || '',
  password: process.env.PG_PASS || '',
  database: process.env.PG_DB || '',
  queryTimeout: Number(process.env.PG_QUERY_TIMEOUT) || 30000,
  connectionTimeout: Number(process.env.PG_CONNECTION_TIMEOUT) || 5000,
}

const clickHouseConfig: ClickHouseConfig = {
  port: Number(process.env.CH_PORT) || 0,
  host: process.env.CH_HOST || 'localhost',
  database: process.env.CH_DB || '',
  pass: process.env.CH_PASS || '',
  user: process.env.CH_USER || '',
  ssl: process.env.CH_SSL === 'true' || process.env.CH_SSL === '1',
}

export const envConfig: EnvConfig = {
  pg: pgConfig,
  clickHouse: clickHouseConfig,
};


export async function loadVaultConfig() {
  try {
    const vault = vaultClient.boot('main', {
      api: {
        url: process.env.VAULT_URL ?? '',
        apiVersion: 'v1',
      },
      auth: {
        type: 'token',
        config: { token: process.env.VAULT_TOKEN ?? ''},
      },
    });
    const kv = await vault.read(process.env.VAULT_PATH ?? '');

    Object.assign(envConfig, kv.getData())
    console.log(`Vault loaded from ${process.env.VAULT_URL}, with path ${process.env.VAULT_PATH}`);
  } catch (e) {
    console.log(`Vault failed to load: ${(e as Error).message}`);
    console.log('using .env')
  }
}