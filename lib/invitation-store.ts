import { createToken, familyKey, InvitationError, validateFamilies, validateResponse } from "./invitations";
import type { AdminInvitation, GuestInvitation, Invitation, InvitationMember } from "./invitations";

type FamilyRow = { id: string; family_name: string; head_name: string; token: string; active: number; revision: number; message: string; responded_at: string | null };
type MemberRow = InvitationMember & { family_id: string };
function present(row: FamilyRow, members: InvitationMember[]): Invitation {
  return {
    id: row.id, familyName: row.family_name, headName: row.head_name, revision: row.revision,
    message: row.message, respondedAt: row.responded_at, status: row.responded_at ? "Confirmado" : "Pendente",
    totalGuests: members.length, companionLimit: Math.max(0, members.length - 1),
    members: members.map(({ id, name, kind, attendance }) => ({ id, name, kind, attendance })),
  };
}
export function guestView(invitation: Invitation): GuestInvitation {
  if (invitation.status === "Confirmado") return { status: "Confirmado", anyAttending: invitation.members.some((member) => member.attendance === "sim") };
  return { ...invitation, status: "Pendente" };
}
export async function getInvitation(db: D1Database, token: string): Promise<Invitation> {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new InvitationError("Este convite não foi encontrado ou foi desativado. Peça o link à família da Luna.", 404);
  const family = await db.prepare("SELECT * FROM invitation_families WHERE token = ? AND active = 1").bind(token).first<FamilyRow>();
  if (!family) throw new InvitationError("Este convite não foi encontrado ou foi desativado. Peça o link à família da Luna.", 404);
  const { results } = await db.prepare("SELECT id, name, kind, attendance FROM invitation_members WHERE family_id = ? ORDER BY position").bind(family.id).all<InvitationMember>();
  return present(family, results);
}
export async function respondToInvitation(db: D1Database, token: string, payload: unknown) {
  const invitation = await getInvitation(db, token);
  if (invitation.respondedAt) throw new InvitationError("Este convite já foi respondido. Entre em contato diretamente com os pais para alterações.", 409, "ALREADY_CONFIRMED");
  const answer = validateResponse(payload, invitation.members);
  if (answer.revision !== invitation.revision) throw new InvitationError("Esta resposta foi atualizada em outro dispositivo. Recarregue o convite antes de responder novamente.", 409);
  // D1 batch is transactional. Every write shares a compare-and-swap guard.
  const guard = "EXISTS (SELECT 1 FROM invitation_families WHERE id = ? AND token = ? AND active = 1 AND revision = ? AND responded_at IS NULL)";
  const statements = answer.responses.map((member) => db.prepare(`UPDATE invitation_members SET attendance = ? WHERE id = ? AND family_id = ? AND ${guard}`).bind(member.attendance, member.id, invitation.id, invitation.id, token, answer.revision));
  statements.push(db.prepare("UPDATE invitation_families SET message = ?, responded_at = CURRENT_TIMESTAMP, revision = revision + 1 WHERE id = ? AND token = ? AND active = 1 AND revision = ? AND responded_at IS NULL").bind(answer.message, invitation.id, token, answer.revision));
  const result = await db.batch(statements);
  if (result.at(-1)?.meta.changes !== 1) {
    const latest = await getInvitation(db, token);
    if (latest.respondedAt) throw new InvitationError("Este convite já foi respondido. Entre em contato diretamente com os pais para alterações.", 409, "ALREADY_CONFIRMED");
    throw new InvitationError("O convite mudou durante o envio. Recarregue a página e tente novamente.", 409);
  }
  return getInvitation(db, token);
}

// Admin-only corrections never clear responded_at or reopen the guest form.
// The audit row and all member updates commit together under the same revision.
export async function correctInvitation(db: D1Database, id: string, payload: unknown, adminEmail: string) {
  const family = await db.prepare("SELECT * FROM invitation_families WHERE id = ?").bind(id).first<FamilyRow>();
  if (!family) throw new InvitationError("Família não encontrada.", 404);
  if (!family.responded_at) throw new InvitationError("Aguarde a primeira resposta da família antes de corrigir.", 409);
  const { results: members } = await db.prepare("SELECT id, name, kind, attendance FROM invitation_members WHERE family_id = ? ORDER BY position").bind(id).all<InvitationMember>();
  const answer = validateResponse(payload, members);
  if (answer.revision !== family.revision) throw new InvitationError("Outra pessoa atualizou este convite. Atualize a lista antes de corrigir.", 409);
  const guard = "EXISTS (SELECT 1 FROM invitation_families WHERE id = ? AND revision = ? AND responded_at IS NOT NULL)";
  const statements = [
    db.prepare(`INSERT INTO invitation_corrections (id, family_id, admin_email, previous_answers, new_answers) SELECT ?, ?, ?, ?, ? WHERE ${guard}`)
      .bind(crypto.randomUUID(), id, adminEmail, JSON.stringify({ responses: members.map(({ id, attendance }) => ({ id, attendance })), message: family.message }), JSON.stringify({ responses: answer.responses, message: answer.message }), id, answer.revision),
    ...answer.responses.map((member) => db.prepare(`UPDATE invitation_members SET attendance = ? WHERE id = ? AND family_id = ? AND ${guard}`).bind(member.attendance, member.id, id, id, answer.revision)),
    db.prepare("UPDATE invitation_families SET message = ?, revision = revision + 1 WHERE id = ? AND revision = ? AND responded_at IS NOT NULL").bind(answer.message, id, answer.revision),
  ];
  const result = await db.batch(statements);
  if (result.at(-1)?.meta.changes !== 1) throw new InvitationError("Outra pessoa atualizou este convite. Atualize a lista antes de corrigir.", 409);
}
export async function listInvitations(db: D1Database): Promise<AdminInvitation[]> {
  const [families, members] = await db.batch([
    db.prepare("SELECT * FROM invitation_families ORDER BY family_name COLLATE NOCASE"),
    db.prepare("SELECT id, family_id, name, kind, attendance FROM invitation_members ORDER BY position"),
  ]);
  const grouped = new Map<string, InvitationMember[]>();
  for (const member of members.results as MemberRow[]) { const group = grouped.get(member.family_id) ?? []; group.push(member); grouped.set(member.family_id, group); }
  return (families.results as FamilyRow[]).map((row) => ({ ...present(row, grouped.get(row.id) ?? []), token: row.token, active: row.active === 1 }));
}
export async function createInvitations(db: D1Database, value: unknown) {
  const families = validateFamilies(value); const placeholders = families.map(() => "?").join(",");
  const { results } = await db.prepare(`SELECT family_key FROM invitation_families WHERE family_key IN (${placeholders})`).bind(...families.map((family) => familyKey(family.familyName))).all<{ family_key: string }>();
  const existing = new Set(results.map((row) => row.family_key)); const statements: D1PreparedStatement[] = []; const skipped: string[] = [];
  const familyRows: (string | number)[][] = []; const memberRows: (string | number)[][] = [];
  for (const family of families) {
    if (existing.has(familyKey(family.familyName))) { skipped.push(family.familyName); continue; }
    const id = crypto.randomUUID();
    familyRows.push([id, familyKey(family.familyName), family.familyName, family.headName, createToken()]);
    family.members.forEach((member, position) => memberRows.push([crypto.randomUUID(), id, member.name, member.kind, position]));
  }
  // At most 100 bound values per statement and 21 queries per import, even
  // for 100 families / 300 people. One transaction still covers the whole file.
  for (const group of [
    { sql: "INSERT INTO invitation_families (id, family_key, family_name, head_name, token) VALUES ", rows: familyRows },
    { sql: "INSERT INTO invitation_members (id, family_id, name, kind, position) VALUES ", rows: memberRows },
  ]) {
    for (let start = 0; start < group.rows.length; start += 20) {
      const chunk = group.rows.slice(start, start + 20);
      statements.push(db.prepare(group.sql + chunk.map(() => "(?, ?, ?, ?, ?)").join(", ")).bind(...chunk.flat()));
    }
  }
  if (statements.length) {
    try { await db.batch(statements); }
    catch (error) { if (String(error).includes("UNIQUE constraint failed")) throw new InvitationError("Uma família já foi cadastrada durante o envio. Atualize a lista e tente novamente.", 409); throw error; }
  }
  return { created: families.length - skipped.length, skipped };
}
export async function manageInvitation(db: D1Database, id: string, action: string, revision: number) {
  const statement = action === "rotate"
    ? db.prepare("UPDATE invitation_families SET token = ?, revision = revision + 1 WHERE id = ? AND revision = ?").bind(createToken(), id, revision)
    : action === "disable" || action === "enable"
      ? db.prepare("UPDATE invitation_families SET active = ?, revision = revision + 1 WHERE id = ? AND revision = ?").bind(action === "enable" ? 1 : 0, id, revision)
      : null;
  if (!statement) throw new InvitationError("Ação inválida.");
  const result = await statement.run();
  if (result.meta.changes !== 1) throw new InvitationError("O convite foi alterado. Atualize a lista e tente novamente.", 409);
}
