import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/oes_db';

const globalForDb = globalThis as unknown as {
  sqlClient: postgres.Sql | undefined;
};

// Singleton pool cached on globalThis across serverless warm lambda invocations
export const sqlClient =
  globalForDb.sqlClient ??
  postgres(connectionString, {
    max: process.env.NODE_ENV === 'production' ? 5 : 10,
    prepare: false,
    idle_timeout: 10,
    connect_timeout: 10,
  });

if (!globalForDb.sqlClient) {
  globalForDb.sqlClient = sqlClient;
}

export const db = drizzle(sqlClient, { schema });
