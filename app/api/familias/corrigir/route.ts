import { getRawDb } from "../../../../db";
import { correctInvitation } from "../../../../lib/invitation-store";
import { apiError, json, readJson, requireAdmin } from "../../../../lib/api";
import { textValue } from "../../../../lib/invitations";

export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    const user = await requireAdmin();
    const payload = await readJson(request);
    await correctInvitation(getRawDb(), textValue(payload.id, "o convite", 36), payload.answer, user.email.toLowerCase());
    return json({ ok: true });
  } catch (error) { return apiError(error); }
}
