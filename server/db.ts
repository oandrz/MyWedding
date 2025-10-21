import { drizzle } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import pkg from 'pg';
const { Pool: PgPool } = pkg;
import ws from "ws";
import * as schema from "@shared/schema";

// Lazy-loaded database connection
let pool: any = null;
let db: any = null;
let initialized = false;

/**
 * Get database connection. Initializes on first call.
 * Throws error if DATABASE_URL is not set.
 */
export function getDb() {
  if (initialized) {
    return db;
  }

  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database?",
    );
  }

  // Use different drivers based on environment
  const isLocalDevelopment = process.env.NODE_ENV === 'development' && 
    process.env.DATABASE_URL.includes('postgres:5432');

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

  initialized = true;
  return db;
}

/**
 * Get database pool. Initializes connection if needed.
 */
export function getPool() {
  if (!initialized) {
    getDb(); // Initialize if not yet initialized
  }
  return pool;
}

// For backwards compatibility, export db (but this won't be initialized until getDb() is called)
export { db };
