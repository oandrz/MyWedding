import { drizzle } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import pkg from 'pg';
const { Pool: PgPool } = pkg;
import ws from "ws";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Use different drivers based on environment
const isLocalDevelopment = process.env.NODE_ENV === 'development' && 
  process.env.DATABASE_URL.includes('postgres:5432');

let pool: any;
let db: any;

if (isLocalDevelopment) {
  // Use standard PostgreSQL driver for local development
  pool = new PgPool({ connectionString: process.env.DATABASE_URL });
  db = drizzlePg({ client: pool, schema });
  console.log('Using PostgreSQL driver for local development');
} else {
  // Use Neon serverless driver for production
  neonConfig.webSocketConstructor = ws;
  pool = new NeonPool({ connectionString: process.env.DATABASE_URL });
  db = drizzle({ client: pool, schema });
  console.log('Using Neon serverless driver for production');
}

export { pool, db };
