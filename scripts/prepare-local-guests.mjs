// Local-only preparation. Never deploys, reaches a remote DB, resets responses,
// or prints individual names/tokens. The source CSV and outputs stay private.
import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { drizzle } from "drizzle-orm/d1";
import { migrate } from "drizzle-orm/d1/migrator";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);
process.env.WRANGLER_WRITE_LOGS = "false";
process.env.WRANGLER_LOG_PATH = resolve(root, ".wrangler/logs");
process.env.MINIFLARE_REGISTRY_PATH = resolve(root, ".wrangler/registry");
if (!process.argv[2] || process.argv.length !== 3) throw new Error("Uso: node scripts/prepare-local-guests.mjs caminho-do-arquivo.csv");

const configPath = resolve(root, "dist/server/wrangler.json");
const config = JSON.parse(await readFile(configPath, "utf8"));
assert.equal(config.d1_databases?.find((item) => item.binding === "DB")?.database_id, "00000000-0000-4000-8000-000000000000", "A configuração deve usar exclusivamente o banco fictício local.");
const compiled = await build({
  stdin: { contents: 'export * from "./lib/invitations.ts"; export * from "./lib/invitation-store.ts";', resolveDir: root },
  bundle: true, write: false, format: "esm", platform: "node",
});
const { parseGuestCsv, createInvitations, listInvitations, familyKey } = await import("data:text/javascript;base64," + Buffer.from(compiled.outputFiles[0].text).toString("base64"));
const input = parseGuestCsv(await readFile(resolve(process.argv[2]), "utf8"));
const { getPlatformProxy } = await import("wrangler");
const platform = await getPlatformProxy({ configPath, persist: { path: resolve(root, ".wrangler/state/v3") }, remoteBindings: false });
try {
  const db = platform.env.DB;
  const tables = (await db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all()).results.map((row) => row.name);
  if (tables.includes("rsvps") && !tables.includes("__drizzle_migrations")) throw new Error("Banco local existente sem histórico de migrações. Revise-o antes de continuar; nenhum registro foi substituído.");
  await migrate(drizzle(db), { migrationsFolder: resolve(root, "drizzle") });
  const result = await createInvitations(db, input);
  const saved = await listInvitations(db);
  const imported = input.map((family) => {
    const row = saved.find((candidate) => familyKey(candidate.familyName) === familyKey(family.familyName));
    assert.ok(row, "Família ausente após a importação.");
    assert.equal(row.headName, family.headName, "Responsável divergente; o registro anterior foi preservado.");
    assert.deepEqual(row.members.map(({ name, kind }) => ({ name, kind })), family.members, "Lista divergente; o registro anterior foi preservado.");
    assert.equal(row.totalGuests, family.members.length);
    assert.equal(row.companionLimit, Math.max(family.members.length - 1, 0));
    assert.match(row.token, /^[a-f0-9]{64}$/);
    return row;
  });
  assert.equal(new Set(imported.map((family) => family.token)).size, imported.length);
  const report = {
    environment: "local-only", created: result.created, previouslyRegistered: result.skipped.length,
    families: imported.length, people: imported.reduce((sum, family) => sum + family.members.length, 0),
    companionLimits: imported.reduce((sum, family) => sum + family.companionLimit, 0),
    pendingFamilies: imported.filter((family) => family.status === "Pendente").length,
    confirmedFamilies: imported.filter((family) => family.status === "Confirmado").length,
    ages: Object.fromEntries(["adulto", "crianca", "crianca_menor5", "nao_informado"].map((kind) => [kind, imported.flatMap((family) => family.members).filter((person) => person.kind === kind).length])),
  };
  await mkdir(resolve(root, "outputs"), { recursive: true });
  await writeFile(resolve(root, "outputs/local-guest-import-summary.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report));
} finally {
  await platform.dispose();
}
