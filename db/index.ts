import { env } from "cloudflare:workers";

// Schema is managed exclusively by the versioned migrations.
export function getRawDb(): D1Database {
  if (!env.DB) throw new Error("O banco de confirmações não está disponível.");
  return env.DB;
}
