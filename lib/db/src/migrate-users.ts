/**
 * One-time migration: create the users table for Task #132.
 * Run: /home/runner/workspace/scripts/node_modules/.bin/tsx lib/db/src/migrate-users.ts
 */
import { pool } from "./index";

await pool.query(`
  CREATE TABLE IF NOT EXISTS users (
    id           SERIAL PRIMARY KEY,
    clerk_id     TEXT NOT NULL UNIQUE,
    email        TEXT NOT NULL,
    first_name   TEXT,
    last_name    TEXT,
    image_url    TEXT,
    status       TEXT NOT NULL DEFAULT 'PENDING',
    company      TEXT,
    admin_note   TEXT,
    last_sign_in_at TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`);

console.log("users table created (or already existed)");
await pool.end();
