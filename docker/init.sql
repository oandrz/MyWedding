-- Initialize Wedding Invitation Database
-- This file runs automatically when PostgreSQL starts for the first time

-- Create database (if not exists)
SELECT 'CREATE DATABASE wedding_invitation_db'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'wedding_invitation_db');

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE wedding_invitation_db TO wedding_user;

-- You can add any initial data setup here if needed
-- The Drizzle schema will be applied when the app starts