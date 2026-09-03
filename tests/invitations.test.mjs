import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { Miniflare } from "miniflare";
import { build } from "esbuild";

test("CSV import validates named rosters and protects exported spreadsheets", async () => {
  const compiled = await build({ entryPoints: ["lib/invitations.ts"], bundle: true, write: false, format: "esm", platform: "node" });
  const { parseGuestCsv, csvCell, createToken } = await import("data:text/javascript;base64," + Buffer.from(compiled.outputFiles[0].text).toString("base64"));
  const list = parseGuestCsv('\uFEFFfamilia;responsavel;nome;tipo\r\nFamília A;Ana;Ana;adulto\r\nFamília A;Ana;Bia;criança');
  assert.equal(list.length, 1); assert.equal(list[0].members.length, 2); assert.equal(list[0].members[1].kind, "crianca");
  assert.equal(parseGuestCsv('familia,responsavel,nome,tipo\n"Família, A",Ana,Ana,adulto')[0].familyName, "Família, A");
  assert.throws(() => parseGuestCsv("familia;responsavel;nome;tipo\nA;Ana;Bia;crianca"), /Inclua Ana/);
  assert.throws(() => parseGuestCsv("familia;responsavel;nome;tipo\nA;Ana;Ana;adulto\nA;Ana;ANA;adulto"), /repetidos/);
  assert.throws(() => parseGuestCsv("familia;responsavel;nome;tipo\nA;Ana;Ana;outro"), /adulto ou crianca/);
  assert.throws(() => parseGuestCsv('familia;responsavel;nome;tipo\n"A;Ana;Ana;adulto'), /aspas não fechadas/);
  assert.equal(csvCell("=1+1"), '"\'=1+1"'); assert.equal(csvCell("@SUM(A1)"), '"\'@SUM(A1)"');
  assert.match(createToken(), /^[a-f0-9]{64}$/); assert.notEqual(createToken(), createToken());
});

test("production Worker: household RSVP, access control and data preservation", { timeout: 120_000 }, async (t) => {
  const serverFiles = (await readdir("dist/server", { recursive: true })).filter((name) => name.endsWith(".js") && name !== "index.js");
  const mf = new Miniflare({
    modules: ["index.js", ...serverFiles].map((name) => ({ type: "ESModule", path: resolve("dist/server", name) })),
    compatibilityDate: "2026-05-15", compatibilityFlags: ["nodejs_compat"],
    d1Databases: ["DB"], bindings: { ADMIN_EMAILS: "admin@example.invalid,second@example.invalid" },
  });
  try {
    const db = await mf.getD1Database("DB");
    const files = (await readdir("drizzle")).filter((name) => name.endsWith(".sql")).sort();
    for (const name of files) {
      const sql = (await readFile(resolve("drizzle", name), "utf8")).replaceAll("--> statement-breakpoint", "");
      for (const statement of sql.split(";").map((sql) => sql.trim()).filter(Boolean)) await db.prepare(statement).run();
    }
    await db.prepare("INSERT INTO rsvps (guest_name, attendance, adults, children, phone) VALUES (?, ?, ?, ?, ?)").bind("Registro anterior de teste", "sim", 2, 1, "00000000").run();
    const admin = { "oai-authenticated-user-id": "test-admin", "oai-authenticated-user-email": "admin@example.invalid" };
    async function api(path, { method = "GET", headers = {}, body } = {}) {
      return mf.dispatchFetch("https://luna.test" + path, { method, redirect: "manual", headers: { ...headers, ...(body === undefined ? {} : { "Content-Type": "application/json" }) }, ...(body === undefined ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) }) });
    }
    const input = [
      { familyName: "Família Alfa (teste)", headName: "Ana Teste", members: [{ name: "Ana Teste", kind: "adulto" }, { name: "Bruno Teste", kind: "adulto" }, { name: "Clara Teste", kind: "crianca" }] },
      { familyName: "Família Beta (teste)", headName: "Daniel Teste", members: [{ name: "Daniel Teste", kind: "adulto" }] },
    ];
    await t.test("anonymous users cannot list, create, change or export families", async () => {
      for (const [path, method] of [["/api/familias", "GET"], ["/api/familias", "POST"], ["/api/familias", "PATCH"], ["/api/confirmacoes/exportar", "GET"]]) {
        assert.equal((await api(path, { method, ...(method === "GET" ? {} : { body: {} }) })).status, 401);
      }
      assert.equal((await api("/api/familias", { headers: { ...admin, "oai-authenticated-user-email": "outsider@example.invalid" } })).status, 403);
      assert.equal((await api("/api/convite")).status, 401);
      assert.equal((await api("/confirmacoes")).status, 307);
    });
    await t.test("only allowlisted admins may create a predefined roster", async () => {
      assert.equal((await api("/api/familias", { method: "POST", headers: { ...admin, Origin: "https://attacker.invalid" }, body: { families: input } })).status, 403);
      const created = await api("/api/familias", { method: "POST", headers: admin, body: { families: input } });
      assert.equal(created.status, 201, await created.clone().text());
      assert.equal((await created.json()).created, 2);
      const repeat = await api("/api/familias", { method: "POST", headers: admin, body: { families: input } });
      assert.equal((await repeat.json()).created, 0);
      assert.equal((await api("/api/familias", { headers: { ...admin, "oai-authenticated-user-email": "second@example.invalid" } })).status, 200);
    });
    const listed = await (await api("/api/familias", { headers: admin })).json();
    const family = listed.families.find((family) => family.headName === "Ana Teste");
    const other = listed.families.find((family) => family.headName === "Daniel Teste");
    const guestHeaders = { Authorization: "Bearer " + family.token };
    const original = { revision: 0, message: "", responses: family.members.map((member, index) => ({ id: member.id, attendance: index === 1 ? "nao" : "sim" })) };
    await t.test("individual link exposes only its household and is never cached", async () => {
      const response = await api("/api/convite", { headers: guestHeaders });
      assert.match(response.headers.get("cache-control"), /no-store/);
      assert.equal(response.headers.get("referrer-policy"), "strict-origin");
      const data = await response.json();
      assert.equal(data.invitation.members.length, 3); assert.equal(data.invitation.token, undefined);
      assert.doesNotMatch(JSON.stringify(data), /Daniel Teste/);
      assert.equal((await api("/api/convite", { headers: { Authorization: "Bearer " + "f".repeat(64) } })).status, 404);
    });
    await t.test("extra, duplicate, missing and cross-family guests are rejected", async () => {
      const invalid = [
        { ...original, adults: 50 },
        { ...original, responses: [...original.responses, { id: other.members[0].id, attendance: "sim" }] },
        { ...original, responses: [{ id: other.members[0].id, attendance: "sim" }, ...original.responses.slice(1)] },
        { ...original, responses: [original.responses[0], original.responses[0], original.responses[2]] },
        { ...original, responses: original.responses.slice(1) },
        { ...original, responses: original.responses.map((answer) => ({ ...answer, attendance: "pendente" })) },
        { ...original, responses: original.responses.map((answer) => ({ ...answer, name: "Hacked" })) },
      ];
      for (const body of invalid) assert.equal((await api("/api/convite", { method: "POST", headers: guestHeaders, body })).status, 400);
      const saved = await (await api("/api/convite", { headers: guestHeaders })).json();
      assert.ok(saved.invitation.members.every((member) => member.attendance === "pendente"));
      assert.equal((await api("/api/confirmacoes", { method: "POST", body: { guestName: "Livre", adults: 99 } })).status, 410);
    });
    await t.test("responses persist per person, can be changed, and cannot be duplicated", async () => {
      const response = await api("/api/convite", { method: "POST", headers: guestHeaders, body: original });
      assert.equal(response.status, 200, await response.clone().text());
      const saved = (await response.json()).invitation;
      assert.deepEqual(saved.members.map((member) => member.attendance), ["sim", "nao", "sim"]);
      assert.equal(saved.revision, 1); assert.ok(saved.respondedAt);
      assert.equal((await api("/api/convite", { method: "POST", headers: guestHeaders, body: original })).status, 409);
      const update = { ...original, revision: 1, responses: original.responses.map((member) => ({ ...member, attendance: "nao" })) };
      assert.equal((await api("/api/convite", { method: "POST", headers: guestHeaders, body: update })).status, 200);
      const otherData = await (await api("/api/convite", { headers: { Authorization: "Bearer " + other.token } })).json();
      assert.equal(otherData.invitation.members[0].attendance, "pendente");
      assert.equal((await db.prepare("SELECT count(*) AS n FROM invitation_members").first()).n, 4);
      assert.equal((await db.prepare("SELECT count(*) AS n FROM rsvps").first()).n, 1);
    });
    await t.test("concurrent submissions are atomic; exactly one revision wins", async () => {
      const replies = await Promise.all(["sim", "nao"].map((attendance) => api("/api/convite", { method: "POST", headers: guestHeaders, body: { revision: 2, message: attendance, responses: original.responses.map((member) => ({ ...member, attendance })) } })));
      assert.deepEqual(replies.map((response) => response.status).sort(), [200, 409]);
      const saved = (await (await api("/api/convite", { headers: guestHeaders })).json()).invitation;
      assert.ok(saved.members.every((member) => member.attendance === saved.message));
    });
    await t.test("link revocation and replacement preserve previously saved responses", async () => {
      let current = (await (await api("/api/familias", { headers: admin })).json()).families.find((row) => row.id === family.id);
      assert.equal((await api("/api/familias", { method: "PATCH", headers: admin, body: { id: family.id, revision: current.revision, action: "disable" } })).status, 200);
      assert.equal((await api("/api/convite", { headers: guestHeaders })).status, 404);
      current = (await (await api("/api/familias", { headers: admin })).json()).families.find((row) => row.id === family.id);
      await api("/api/familias", { method: "PATCH", headers: admin, body: { id: family.id, revision: current.revision, action: "enable" } });
      current = (await (await api("/api/familias", { headers: admin })).json()).families.find((row) => row.id === family.id);
      await api("/api/familias", { method: "PATCH", headers: admin, body: { id: family.id, revision: current.revision, action: "rotate" } });
      assert.equal((await api("/api/convite", { headers: guestHeaders })).status, 404);
      current = (await (await api("/api/familias", { headers: admin })).json()).families.find((row) => row.id === family.id);
      assert.notEqual(current.token, family.token); assert.ok(current.respondedAt);
      assert.equal((await api("/api/convite", { headers: { Authorization: "Bearer " + current.token } })).status, 200);
    });
    await t.test("exports and protected dashboard load; legacy data stays separate", async () => {
      for (const query of ["", "?links=1", "?historico=1"]) {
        const response = await api("/api/confirmacoes/exportar" + query, { headers: admin });
        assert.equal(response.status, 200); assert.match(response.headers.get("cache-control"), /no-store/);
        const csv = await response.text(); assert.match(csv, query.includes("historico") ? /Registro anterior de teste/ : /Família Alfa/);
      }
      const response = await api("/confirmacoes", { headers: admin });
      assert.equal(response.status, 200, await response.clone().text());
      assert.match(await response.text(), /Famílias e confirmações/);
    });
    await t.test("public invitation renders without exposing any roster in its HTML", async () => {
      const response = await api("/?convite=" + family.token);
      assert.equal(response.status, 200);
      const html = await response.text();
      assert.match(html, /E Deus criou/); assert.doesNotMatch(html, /Ana Teste|Daniel Teste/);
      assert.match(response.headers.get("cache-control"), /no-store/);
    });
  } finally { await mf.dispose(); }
});
