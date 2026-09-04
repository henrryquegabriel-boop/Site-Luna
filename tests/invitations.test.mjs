import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { Miniflare } from "miniflare";
import { build } from "esbuild";

async function library(entryPoint = "lib/invitations.ts") {
  const compiled = await build({ entryPoints: [entryPoint], bundle: true, write: false, format: "esm", platform: "node" });
  return import("data:text/javascript;base64," + Buffer.from(compiled.outputFiles[0].text).toString("base64"));
}

test("named CSV rosters preserve aliases, child heads, missing ages and exact counts", async () => {
  const { parseGuestCsv, csvCell, createToken, validateFamilies } = await library();
  const list = parseGuestCsv('\uFEFFfamilia;responsavel;nome;tipo\r\nFamília A;Ana;Ana;adulto\r\nFamília A;Ana;Bia;crianca_menor5');
  assert.equal(list.length, 1); assert.equal(list[0].members.length, 2);
  assert.equal(parseGuestCsv('familia,responsavel,nome,tipo\n"Família, A",Ana,Ana,adulto')[0].familyName, "Família, A");
  const alias = validateFamilies([{ familyName: "Alias", headName: "Tia", members: [{ name: "Nome real", kind: "nao_informado" }] }]);
  assert.equal(alias[0].members.length, 1);
  assert.equal(alias[0].members[0].name, "Nome real");
  assert.throws(() => parseGuestCsv("familia;responsavel;nome;tipo\nA;Ana;Ana;adulto\nA;Ana;ANA;adulto"), /repetidos/);
  assert.throws(() => parseGuestCsv("familia;responsavel;nome;tipo\nA;Ana;Ana;outro"), /faixa etária/);
  assert.throws(() => parseGuestCsv('familia;responsavel;nome;tipo\n"A;Ana;Ana;adulto'), /aspas não fechadas/);
  assert.equal(csvCell("=1+1"), '"\'=1+1"');
  assert.equal(csvCell("@SUM(A1)"), '"\'@SUM(A1)"');
  assert.match(createToken(), /^[a-f0-9]{64}$/);
  assert.notEqual(createToken(), createToken());
});

test("production Worker: one-time named invitations and administrator corrections", { timeout: 120_000 }, async (t) => {
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
      const statements = sql.split(";").map((sql) => sql.trim()).filter(Boolean);
      await db.batch(statements.map((sql) => db.prepare(sql)));
      if (name.startsWith("0002")) {
        await db.prepare("INSERT INTO invitation_families (id, family_key, family_name, head_name, token) VALUES ('pre-migration', 'old', 'Old family', 'Old head', ?)").bind("a".repeat(64)).run();
        await db.prepare("INSERT INTO invitation_members (id, family_id, name, kind, position) VALUES ('old-member', 'pre-migration', 'Old head', 'adulto', 0)").run();
      }
    }
    await db.prepare("INSERT INTO rsvps (guest_name, attendance, adults, children, phone) VALUES (?, ?, ?, ?, ?)").bind("Registro anterior de teste", "sim", 2, 1, "00000000").run();
    const admin = { "oai-authenticated-user-id": "test-admin", "oai-authenticated-user-email": "admin@example.invalid" };
    const second = { ...admin, "oai-authenticated-user-email": "second@example.invalid" };
    async function api(path, { method = "GET", headers = {}, body } = {}) {
      return mf.dispatchFetch("https://luna.test" + path, {
        method, redirect: "manual",
        headers: { ...headers, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
        ...(body === undefined ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) }),
      });
    }
    async function list() { return (await (await api("/api/familias", { headers: admin })).json()).families; }
    const input = [
      { familyName: "Família Alfa (teste)", headName: "Ana Teste", members: [{ name: "Ana Teste", kind: "adulto" }, { name: "Bruno Teste", kind: "adulto" }, { name: "Clara Teste", kind: "crianca_menor5" }] },
      { familyName: "Família Beta (teste)", headName: "Apelido responsável", members: [{ name: "Nome na planilha", kind: "nao_informado" }, { name: "Criança Teste", kind: "crianca" }] },
    ];
    await t.test("migration preserves previous members and required database columns", async () => {
      assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM invitation_members WHERE id = 'old-member'").first()).n, 1);
      const row = await db.prepare("SELECT * FROM guest_invitations WHERE ID_Convidado = 'pre-migration'").first();
      assert.deepEqual(Object.keys(row), ["ID_Convidado", "Nome_Chefe_Familia", "Token_Unico", "Limite_Acompanhantes", "Status_Confirmacao"]);
      assert.equal(row.Limite_Acompanhantes, 0);
      assert.equal(row.Status_Confirmacao, "Pendente");
    });
    await t.test("anonymous users and non-admins cannot list, import, correct or export", async () => {
      for (const [path, method] of [["/api/familias", "GET"], ["/api/familias", "POST"], ["/api/familias", "PATCH"], ["/api/familias/corrigir", "POST"], ["/api/confirmacoes/exportar", "GET"]]) {
        assert.equal((await api(path, { method, ...(method === "GET" ? {} : { body: {} }) })).status, 401);
      }
      for (const path of ["/api/familias", "/api/familias/corrigir"]) {
        assert.equal((await api(path, { method: path.endsWith("corrigir") ? "POST" : "GET", headers: { ...admin, "oai-authenticated-user-email": "outsider@example.invalid" } })).status, 403);
      }
      assert.equal((await api("/api/convite")).status, 401);
      assert.equal((await api("/confirmacoes")).status, 307);
    });
    await t.test("admin import never adds the head twice and retries do not duplicate families", async () => {
      assert.equal((await api("/api/familias", { method: "POST", headers: { ...admin, Origin: "https://attacker.invalid" }, body: { families: input } })).status, 403);
      const response = await api("/api/familias", { method: "POST", headers: admin, body: { families: input } });
      assert.equal(response.status, 201, await response.clone().text());
      assert.equal((await response.json()).created, 2);
      const retry = await api("/api/familias", { method: "POST", headers: admin, body: { families: input } });
      assert.equal((await retry.json()).created, 0);
      assert.equal((await api("/api/familias", { headers: second })).status, 200);
    });
    const families = await list();
    const family = families.find((family) => family.headName === "Ana Teste");
    const other = families.find((family) => family.headName === "Apelido responsável");
    const guestHeaders = { Authorization: "Bearer " + family.token };
    const original = { revision: 0, message: "Primeira resposta", responses: family.members.map((member, index) => ({ id: member.id, attendance: index === 1 ? "nao" : "sim" })) };
    await t.test("the limit equals roster size minus one, with no public roster enumeration", async () => {
      const response = await api("/api/convite", { headers: guestHeaders });
      assert.match(response.headers.get("cache-control"), /no-store/);
      assert.equal(response.headers.get("referrer-policy"), "strict-origin");
      const data = (await response.json()).invitation;
      assert.equal(data.members.length, 3); assert.equal(data.totalGuests, 3); assert.equal(data.companionLimit, 2); assert.equal(data.token, undefined);
      assert.equal(other.members.length, 2); assert.equal(other.companionLimit, 1);
      assert.doesNotMatch(JSON.stringify(data), /Nome na planilha/);
      assert.equal((await api("/api/convite", { headers: { Authorization: "Bearer " + "f".repeat(64) } })).status, 404);
    });
    await t.test("server renders no RSVP form for missing or invalid tokens", async () => {
      for (const path of ["/", "/rsvp", "/?token=wrong", "/?token=" + "f".repeat(64), "/?token=a&token=b"]) {
        const response = await api(path);
        assert.equal(response.status, 200);
        const html = await response.text();
        assert.doesNotMatch(html, /data-rsvp-state="pending"|name="person-|type="radio"/);
        assert.doesNotMatch(html, /Ana Teste|Nome na planilha/);
      }
    });
    await t.test("only the valid token renders its predefined people server-side", async () => {
      for (const path of ["/?token=", "/?convite=", "/rsvp?token="]) {
        const response = await api(path + family.token);
        assert.equal(response.status, 200);
        assert.match(response.headers.get("cache-control"), /no-store/);
        const html = await response.text();
        assert.match(html, /data-rsvp-state="pending"/);
        assert.match(html, /Ana Teste/); assert.match(html, /Bruno Teste/); assert.match(html, /Clara Teste/);
        assert.doesNotMatch(html, /Nome na planilha|name="adults"|name="children"|name="guestName"/);
        assert.equal((html.match(/type="radio"/g) ?? []).length, 6);
      }
    });
    await t.test("server rejects excessive, missing, duplicate, cross-family and altered names", async () => {
      const invalid = [
        { ...original, adults: 50 }, { ...original, companionLimit: 99 },
        { ...original, responses: [...original.responses, { id: other.members[0].id, attendance: "sim" }] },
        { ...original, responses: [{ id: other.members[0].id, attendance: "sim" }, ...original.responses.slice(1)] },
        { ...original, responses: [original.responses[0], original.responses[0], original.responses[2]] },
        { ...original, responses: original.responses.slice(1) },
        { ...original, responses: original.responses.map((answer) => ({ ...answer, attendance: "pendente" })) },
        { ...original, responses: original.responses.map((answer) => ({ ...answer, name: "Uninvited" })) },
      ];
      for (const body of invalid) assert.equal((await api("/api/convite", { method: "POST", headers: guestHeaders, body })).status, 400);
      assert.equal((await api("/api/convite", { method: "POST", headers: { ...guestHeaders, Origin: "https://attacker.invalid" }, body: original })).status, 403);
      assert.equal((await api("/api/convite", { method: "POST", headers: guestHeaders, body: "{" })).status, 400);
      assert.equal((await api("/api/confirmacoes", { method: "POST", body: { guestName: "Livre", adults: 99 } })).status, 410);
      assert.ok((await list()).find((row) => row.id === family.id).members.every((row) => row.attendance === "pendente"));
    });
    await t.test("first response commits once; every later submission is denied even with fresh revision", async () => {
      const response = await api("/api/convite", { method: "POST", headers: guestHeaders, body: original });
      assert.equal(response.status, 200, await response.clone().text());
      assert.deepEqual((await response.json()).invitation, { status: "Confirmado", anyAttending: true });
      const saved = (await list()).find((row) => row.id === family.id);
      assert.deepEqual(saved.members.map((row) => row.attendance), ["sim", "nao", "sim"]);
      assert.equal(saved.status, "Confirmado"); assert.equal(saved.revision, 1);
      for (const revision of [0, 1, 999]) {
        const retry = await api("/api/convite", { method: "POST", headers: guestHeaders, body: { ...original, revision } });
        assert.equal(retry.status, 409); assert.equal((await retry.json()).code, "ALREADY_CONFIRMED");
      }
      const view = await db.prepare("SELECT * FROM guest_invitations WHERE ID_Convidado = ?").bind(family.id).first();
      assert.equal(view.Status_Confirmacao, "Confirmado"); assert.equal(view.Limite_Acompanhantes, 2);
      assert.equal((await db.prepare("SELECT COUNT(*) AS n FROM rsvps").first()).n, 1);
    });
    await t.test("completed invitations have only the receipt; HTML contains no presence form", async () => {
      const { CONFIRMED_MESSAGE } = await library();
      for (const path of ["/?token=", "/?convite=", "/rsvp?token="]) {
        const response = await api(path + family.token);
        const html = await response.text();
        assert.match(html, /data-rsvp-state="confirmed"/); assert.ok(html.includes(CONFIRMED_MESSAGE));
        assert.doesNotMatch(html, /data-rsvp-state="pending"|type="radio"|name="person-|<textarea|<form/);
        assert.doesNotMatch(html, /Ana Teste|Bruno Teste|Clara Teste/);
      }
      const data = await (await api("/api/convite", { headers: guestHeaders })).json();
      assert.deepEqual(data.invitation, { status: "Confirmado", anyAttending: true });
    });
    await t.test("two simultaneous first replies commit exactly one consistent answer", async () => {
      const headers = { Authorization: "Bearer " + other.token };
      const replies = await Promise.all(["sim", "nao"].map((attendance) => api("/api/convite", { method: "POST", headers, body: { revision: 0, message: attendance, responses: other.members.map((member) => ({ id: member.id, attendance })) } })));
      assert.deepEqual(replies.map((response) => response.status).sort(), [200, 409]);
      const saved = (await list()).find((row) => row.id === other.id);
      assert.equal(saved.revision, 1);
      assert.ok(saved.members.every((member) => member.attendance === saved.message));
    });
    await t.test("parents can correct named attendance with audit; guest access stays locked", async () => {
      const answer = { revision: 1, message: "Correção solicitada aos pais", responses: family.members.map((member) => ({ id: member.id, attendance: "nao" })) };
      const response = await api("/api/familias/corrigir", { method: "POST", headers: second, body: { id: family.id, answer } });
      assert.equal(response.status, 200, await response.clone().text());
      const saved = (await list()).find((row) => row.id === family.id);
      assert.equal(saved.status, "Confirmado"); assert.ok(saved.respondedAt);
      assert.ok(saved.members.every((member) => member.attendance === "nao"));
      assert.equal((await api("/api/convite", { method: "POST", headers: guestHeaders, body: { ...original, revision: 2 } })).status, 409);
      assert.equal((await api("/api/familias/corrigir", { method: "POST", headers: admin, body: { id: family.id, answer } })).status, 409);
      const audit = await db.prepare("SELECT * FROM invitation_corrections WHERE family_id = ?").bind(family.id).all();
      assert.equal(audit.results.length, 1); assert.equal(audit.results[0].admin_email, "second@example.invalid");
      assert.match(audit.results[0].previous_answers, /sim/); assert.match(audit.results[0].new_answers, /nao/);
    });
    await t.test("revocation and token replacement do not reopen completed RSVP", async () => {
      let current = (await list()).find((row) => row.id === family.id);
      await api("/api/familias", { method: "PATCH", headers: admin, body: { id: family.id, revision: current.revision, action: "disable" } });
      assert.equal((await api("/api/convite", { headers: guestHeaders })).status, 404);
      current = (await list()).find((row) => row.id === family.id);
      await api("/api/familias", { method: "PATCH", headers: admin, body: { id: family.id, revision: current.revision, action: "enable" } });
      current = (await list()).find((row) => row.id === family.id);
      await api("/api/familias", { method: "PATCH", headers: admin, body: { id: family.id, revision: current.revision, action: "rotate" } });
      assert.equal((await api("/api/convite", { headers: guestHeaders })).status, 404);
      current = (await list()).find((row) => row.id === family.id);
      const newHeaders = { Authorization: "Bearer " + current.token };
      assert.notEqual(current.token, family.token); assert.equal(current.status, "Confirmado");
      assert.equal((await api("/api/convite", { method: "POST", headers: newHeaders, body: { ...original, revision: current.revision } })).status, 409);
      const html = await (await api("/?token=" + current.token)).text();
      assert.match(html, /Sua resposta \(e de sua família\) já foi registrada/);
      assert.doesNotMatch(html, /<form|type="radio"/);
    });
    await t.test("updated dashboard and exports expose accurate people and family statuses", async () => {
      for (const query of ["", "?links=1", "?historico=1"]) {
        const response = await api("/api/confirmacoes/exportar" + query, { headers: admin });
        assert.equal(response.status, 200); assert.match(response.headers.get("cache-control"), /no-store/);
        const csv = await response.text();
        assert.match(csv, query.includes("historico") ? /Registro anterior de teste/ : /Status_Confirmacao/);
        if (!query.includes("historico")) assert.match(csv, /Confirmado/);
      }
      const response = await api("/confirmacoes", { headers: second });
      assert.equal(response.status, 200, await response.clone().text());
      assert.match(await response.text(), /Famílias e confirmações/);
    });
    await t.test("maximum import fits D1 parameter and query limits without partial families", async () => {
      const { createInvitations } = await library("lib/invitation-store.ts");
      let queries = 0;
      const checkedDb = {
        prepare(sql) {
          queries++;
          const statement = db.prepare(sql);
          return { bind(...values) { assert.ok(values.length <= 100); return statement.bind(...values); } };
        },
        batch: (statements) => db.batch(statements),
      };
      const input = Array.from({ length: 100 }, (_, index) => ({
        familyName: `Lote de teste ${index}`, headName: `Responsável ${index}`,
        members: Array.from({ length: 3 }, (_, person) => ({ name: `Pessoa ${index}-${person}`, kind: "adulto" })),
      }));
      assert.equal((await createInvitations(checkedDb, input)).created, 100);
      assert.ok(queries <= 21);
      const saved = (await list()).filter((row) => row.familyName.startsWith("Lote de teste "));
      assert.equal(saved.length, 100);
      assert.equal(saved.flatMap((row) => row.members).length, 300);
      assert.ok(saved.every((row) => row.status === "Pendente" && row.companionLimit === 2 && row.members.every((person) => person.attendance === "pendente")));
      assert.equal(new Set(saved.map((row) => row.token)).size, 100);
    });
  } finally { await mf.dispose(); }
});
