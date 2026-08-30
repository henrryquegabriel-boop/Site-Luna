import { desc } from "drizzle-orm";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { getAllowedAdminEmails } from "../../../admin-emails";
import { ensureRsvpSchema, getDb } from "../../../../db";
import { rsvps } from "../../../../db/schema";

export const dynamic = "force-dynamic";

function csvCell(value: string | number) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export async function GET() {
  const user = await getChatGPTUser();
  const allowedEmails = getAllowedAdminEmails();

  if (!user || !allowedEmails.includes(user.email.toLowerCase())) {
    return new Response("Não autorizado", { status: 401 });
  }

  await ensureRsvpSchema();
  const rows = await getDb().select().from(rsvps).orderBy(desc(rsvps.createdAt), desc(rsvps.id)).limit(5000);
  const header = ["Nome", "Presença", "Adultos", "Crianças", "WhatsApp", "Recado", "Registrado em"];
  const lines = [
    header.map(csvCell).join(","),
    ...rows.map((row) =>
      [
        row.guestName,
        row.attendance === "sim" ? "Sim" : "Não",
        row.adults,
        row.children,
        row.phone,
        row.message,
        row.createdAt,
      ].map(csvCell).join(","),
    ),
  ];

  return new Response(`\uFEFF${lines.join("\r\n")}`, {
    headers: {
      "Content-Disposition": 'attachment; filename="confirmacoes-luna.csv"',
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}
