import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/oes_db';

// Disable prefetch for serverless/edge compatibility if needed
export const sqlClient = postgres(connectionString, { max: 10 });
export const db = drizzle(sqlClient, { schema });
