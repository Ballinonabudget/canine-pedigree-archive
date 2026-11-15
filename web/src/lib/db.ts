import { Pool } from 'pg';

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://daplug@localhost:5432/canine_pedigree_archive';

const globalForPg = globalThis as unknown as { pgPool?: Pool };

export const pool =
  globalForPg.pgPool ||
  new Pool({
    connectionString,
    ssl: process.env.NODE_ENV === 'production' && !connectionString.includes('localhost')
      ? { rejectUnauthorized: false }
      : false,
    max: 10,
    idleTimeoutMillis: 30000,
  });

if (process.env.NODE_ENV !== 'production') globalForPg.pgPool = pool;
