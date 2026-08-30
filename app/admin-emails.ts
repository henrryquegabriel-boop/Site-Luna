import { env } from "cloudflare:workers";

export function getAllowedAdminEmails() {
  const bindings = env as unknown as Record<string, unknown>;

  return [bindings.ADMIN_EMAIL, bindings.ADMIN_EMAILS]
    .flatMap((value) => (typeof value === "string" ? value.split(/[;,]/) : []))
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}
