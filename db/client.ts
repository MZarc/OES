import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/oes_db';

// Disable prefetch and prepared statements for serverless/Supabase pooler compatibility
export const sqlClient = postgres(connectionString, {
  max: process.env.NODE_ENV === 'production' ? 5 : 10,
  prepare: false,
});
export const db = drizzle(sqlClient, { schema });
