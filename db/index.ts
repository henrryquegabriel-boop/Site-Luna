import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

let schemaReady: Promise<void> | null = null;

export function getRawDb(): D1Database {
  if (!env.DB) {
    throw new Error("O banco de confirmações não está disponível.");
  }

  return env.DB;
}

export function getDb() {
  return drizzle(getRawDb(), { schema });
}

export async function ensureRsvpSchema() {
  if (!schemaReady) {
    const d1 = getRawDb();
    schemaReady = d1
      .batch([
        d1.prepare(`
          CREATE TABLE IF NOT EXISTS rsvps (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guest_name TEXT NOT NULL,
            attendance TEXT NOT NULL CHECK (attendance IN ('sim', 'nao')),
            adults INTEGER NOT NULL DEFAULT 0 CHECK (adults >= 0),
            children INTEGER NOT NULL DEFAULT 0 CHECK (children >= 0),
            phone TEXT NOT NULL,
            message TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          )
        `),
        d1.prepare(`
          CREATE INDEX IF NOT EXISTS idx_rsvps_created_at
          ON rsvps(created_at DESC)
        `),
      ])
      .then(async () => {
        await d1.prepare("PRAGMA optimize").run();
      })
      .catch((error) => {
        schemaReady = null;
        throw error;
      });
  }

  return schemaReady;
}
