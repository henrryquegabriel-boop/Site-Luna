import { getRawDb } from "../../../db";
import { getInvitation, guestView, respondToInvitation } from "../../../lib/invitation-store";
import { apiError, invitationToken, json, readJson } from "../../../lib/api";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try { return json({ invitation: guestView(await getInvitation(getRawDb(), invitationToken(request))) }); }
  catch (error) { return apiError(error); }
}
export async function POST(request: Request) {
  try {
    const token = invitationToken(request);
    const payload = await readJson(request);
    return json({ invitation: guestView(await respondToInvitation(getRawDb(), token, payload)) });
  } catch (error) { return apiError(error); }
}
