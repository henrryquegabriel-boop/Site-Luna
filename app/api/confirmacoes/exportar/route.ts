import { getRawDb } from "../../../../db";
import { listInvitations } from "../../../../lib/invitation-store";
import { apiError, privateHeaders, requireAdmin } from "../../../../lib/api";
import { csvCell, invitePath } from "../../../../lib/invitations";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    await requireAdmin();
    const url = new URL(request.url);
    let lines: unknown[][];
    let filename = "confirmacoes-luna.csv";
    if (url.searchParams.has("historico")) {
      const { results } = await getRawDb().prepare("SELECT * FROM rsvps ORDER BY created_at DESC, id DESC").all();
      lines = [["Nome", "Presença", "Adultos", "Crianças", "WhatsApp", "Recado", "Registrado em"], ...results.map((row) => [row.guest_name, row.attendance, row.adults, row.children, row.phone, row.message, row.created_at])];
      filename = "historico-confirmacoes-luna.csv";
    } else {
      const families = await listInvitations(getRawDb());
      if (url.searchParams.has("links")) {
        lines = [["Família", "Responsável", "Convite ativo", "Link individual"], ...families.map((family) => [family.familyName, family.headName, family.active ? "Sim" : "Não", new URL(invitePath(family.token), url.origin).href])];
        filename = "links-familias-luna.csv";
      } else {
        lines = [["Família", "Responsável", "Convidado", "Tipo", "Resposta", "Convite ativo", "Respondido em", "Recado"], ...families.flatMap((family) => family.members.map((member) => [family.familyName, family.headName, member.name, member.kind === "adulto" ? "Adulto" : "Criança", member.attendance === "sim" ? "Vai" : member.attendance === "nao" ? "Não vai" : "Pendente", family.active ? "Sim" : "Não", family.respondedAt, family.message]))];
      }
    }
    return new Response("\uFEFF" + lines.map((line) => line.map(csvCell).join(";")).join("\r\n"), { headers: { ...privateHeaders, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"` } });
  } catch (error) { return apiError(error); }
}
