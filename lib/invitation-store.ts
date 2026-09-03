import { createToken, familyKey, InvitationError, validateFamilies, validateResponse } from "./invitations";
import type { AdminInvitation, Invitation, InvitationMember } from "./invitations";

type FamilyRow = { id: string; family_name: string; head_name: string; token: string; active: number; revision: number; message: string; responded_at: string | null };
type MemberRow = InvitationMember & { family_id: string };
function present(row: FamilyRow, members: InvitationMember[]): Invitation {
  return { id: row.id, familyName: row.family_name, headName: row.head_name, revision: row.revision, message: row.message, respondedAt: row.responded_at, members: members.map(({ id, name, kind, attendance }) => ({ id, name, kind, attendance })) };
}
export async function getInvitation(db: D1Database, token: string): Promise<Invitation> {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new InvitationError("Este convite não foi encontrado ou foi desativado. Peça o link à família da Luna.", 404);
  const family = await db.prepare("SELECT * FROM invitation_families WHERE token = ? AND active = 1").bind(token).first<FamilyRow>();
  if (!family) throw new InvitationError("Este convite não foi encontrado ou foi desativado. Peça o link à família da Luna.", 404);
  const { results } = await db.prepare("SELECT id, name, kind, attendance FROM invitation_members WHERE family_id = ? ORDER BY position").bind(family.id).all<InvitationMember>();
  return present(family, results);
}
export async function respondToInvitation(db: D1Database, token: string, payload: unknown) {
  const invitation = await getInvitation(db, token); const answer = validateResponse(payload, invitation.members);
  if (answer.revision !== invitation.revision) throw new InvitationError("Esta resposta foi atualizada em outro dispositivo. Recarregue o convite antes de responder novamente.", 409);
  // D1 batch is transactional. Every write shares a compare-and-swap guard.
  const guard = "EXISTS (SELECT 1 FROM invitation_families WHERE id = ? AND token = ? AND active = 1 AND revision = ?)";
  const statements = answer.responses.map((member) => db.prepare(`UPDATE invitation_members SET attendance = ? WHERE id = ? AND family_id = ? AND ${guard}`).bind(member.attendance, member.id, invitation.id, invitation.id, token, answer.revision));
  statements.push(db.prepare("UPDATE invitation_families SET message = ?, responded_at = CURRENT_TIMESTAMP, revision = revision + 1 WHERE id = ? AND token = ? AND active = 1 AND revision = ?").bind(answer.message, invitation.id, token, answer.revision));
  const result = await db.batch(statements);
  if (result.at(-1)?.meta.changes !== 1) throw new InvitationError("O convite mudou durante o envio. Recarregue a página e tente novamente.", 409);
  return getInvitation(db, token);
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
  for (const family of families) {
    if (existing.has(familyKey(family.familyName))) { skipped.push(family.familyName); continue; }
    const id = crypto.randomUUID();
    statements.push(db.prepare("INSERT INTO invitation_families (id, family_key, family_name, head_name, token) VALUES (?, ?, ?, ?, ?)").bind(id, familyKey(family.familyName), family.familyName, family.headName, createToken()));
    family.members.forEach((member, position) => statements.push(db.prepare("INSERT INTO invitation_members (id, family_id, name, kind, position) VALUES (?, ?, ?, ?, ?)").bind(crypto.randomUUID(), id, member.name, member.kind, position)));
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
