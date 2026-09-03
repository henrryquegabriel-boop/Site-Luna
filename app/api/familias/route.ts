import { getRawDb } from "../../../db";
import { createInvitations, listInvitations, manageInvitation } from "../../../lib/invitation-store";
import { apiError, json, readJson, requireAdmin } from "../../../lib/api";
import { InvitationError, textValue } from "../../../lib/invitations";

export const dynamic = "force-dynamic";
export async function GET() {
  try { await requireAdmin(); return json({ families: await listInvitations(getRawDb()) }); }
  catch (error) { return apiError(error); }
}
export async function POST(request: Request) {
  try {
    await requireAdmin();
    const payload = await readJson(request);
    return json(await createInvitations(getRawDb(), payload.families), 201);
  } catch (error) { return apiError(error); }
}
export async function PATCH(request: Request) {
  try {
    await requireAdmin();
    const payload = await readJson(request);
    if (!Number.isSafeInteger(payload.revision) || Number(payload.revision) < 0) throw new InvitationError("Atualize a lista antes de continuar.");
    await manageInvitation(getRawDb(), textValue(payload.id, "o convite", 36), textValue(payload.action, "a ação", 20), payload.revision as number);
    return json({ ok: true });
  } catch (error) { return apiError(error); }
}
