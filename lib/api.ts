import { getChatGPTUser } from "../app/chatgpt-auth";
import { getAllowedAdminEmails } from "../app/admin-emails";
import { InvitationError, object } from "./invitations";

export const privateHeaders = { "Cache-Control": "private, no-store, max-age=0", "Referrer-Policy": "strict-origin", "X-Robots-Tag": "noindex, nofollow" };
export function json(data: unknown, status = 200) { return Response.json(data, { status, headers: privateHeaders }); }
export function apiError(error: unknown) {
  if (error instanceof InvitationError) return json({ error: error.message, code: error.code }, error.status);
  console.error("Invitation request failed; no guest data logged.");
  return json({ error: "Não foi possível acessar as confirmações agora. Tente novamente em instantes." }, 503);
}
export function checkOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (request.headers.get("sec-fetch-site") === "cross-site" || (origin && origin !== new URL(request.url).origin)) throw new InvitationError("Origem não permitida.", 403);
}
export async function requireAdmin() {
  const user = await getChatGPTUser();
  if (!user) throw new InvitationError("Entre para acessar a administração.", 401);
  if (!getAllowedAdminEmails().includes(user.email.toLowerCase())) throw new InvitationError("Acesso não autorizado.", 403);
  return user;
}
export function invitationToken(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  if (!token) throw new InvitationError("Use o link individual enviado à sua família para confirmar.", 401);
  return token;
}
export async function readJson(request: Request) {
  checkOrigin(request);
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) throw new InvitationError("Envie os dados no formato JSON.", 415);
  const reader = request.body?.getReader();
  if (!reader) throw new InvitationError("Dados inválidos.");
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const next = await reader.read(); if (next.done) break;
    size += next.value.byteLength;
    if (size > 100_000) { await reader.cancel(); throw new InvitationError("A lista é muito grande. Divida em arquivos menores.", 413); }
    chunks.push(next.value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return object(JSON.parse(new TextDecoder().decode(bytes))); }
  catch { throw new InvitationError("Dados inválidos. Revise o formulário."); }
}
