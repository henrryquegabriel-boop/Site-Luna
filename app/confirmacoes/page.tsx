import { desc } from "drizzle-orm";
import Link from "next/link";
import { chatGPTSignOutPath, requireChatGPTUser } from "../chatgpt-auth";
import { getAllowedAdminEmails } from "../admin-emails";
import { ensureRsvpSchema, getDb } from "../../db";
import { rsvps } from "../../db/schema";

export const dynamic = "force-dynamic";

function formatDate(value: string) {
  const date = new Date(`${value.replace(" ", "T")}Z`);
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

function whatsappLink(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const international = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${international}`;
}

async function Dashboard() {
  const user = await requireChatGPTUser("/confirmacoes");
  const allowedEmails = getAllowedAdminEmails();

  if (!allowedEmails.includes(user.email.toLowerCase())) {
    return (
      <div className="access-denied">
        <p className="eyebrow">Área reservada</p>
        <h1>Acesso não autorizado</h1>
        <p>Esta página é exclusiva para a família da Luna.</p>
        <Link className="admin-link" href={chatGPTSignOutPath("/")}>Sair e voltar ao convite</Link>
      </div>
    );
  }

  await ensureRsvpSchema();
  const db = getDb();
  const rows = await db.select().from(rsvps).orderBy(desc(rsvps.createdAt), desc(rsvps.id)).limit(1000);

  const attending = rows.filter((row) => row.attendance === "sim");
  const adults = attending.reduce((sum, row) => sum + row.adults, 0);
  const children = attending.reduce((sum, row) => sum + row.children, 0);

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <div>
          <p className="eyebrow">Festa de 1 ano da Luna</p>
          <h1>Confirmações</h1>
          <p>Olá, {user.displayName}. Aqui estão as respostas recebidas.</p>
        </div>
        <nav className="admin-actions" aria-label="Ações da área administrativa">
          <Link className="admin-link" href="/">Ver convite</Link>
          <a className="admin-link" href="/api/confirmacoes/exportar">Baixar planilha CSV</a>
          <Link className="admin-link" href={chatGPTSignOutPath("/")}>Sair</Link>
        </nav>
      </header>

      <section className="stats-grid" aria-label="Resumo das confirmações">
        <article className="stat-card">
          <span>Respostas</span>
          <strong>{rows.length}</strong>
          <small>famílias ou convidados</small>
        </article>
        <article className="stat-card">
          <span>Presenças</span>
          <strong>{attending.length}</strong>
          <small>confirmaram que vão</small>
        </article>
        <article className="stat-card">
          <span>Adultos</span>
          <strong>{adults}</strong>
          <small>pessoas confirmadas</small>
        </article>
        <article className="stat-card">
          <span>Crianças</span>
          <strong>{children}</strong>
          <small>pequenos confirmados</small>
        </article>
      </section>

      <section className="responses-panel" aria-label="Lista de respostas">
        <div className="response-row response-head" aria-hidden="true">
          <span>Convidado</span>
          <span>Resposta</span>
          <span>Pessoas</span>
          <span>Contato</span>
          <span>Recado</span>
        </div>
        {rows.length === 0 ? (
          <p className="empty-state">As primeiras confirmações aparecerão aqui.</p>
        ) : (
          rows.map((row) => (
            <article className="response-row" key={row.id}>
              <div className="response-name">
                <strong>{row.guestName}</strong>
                <small>{formatDate(row.createdAt)}</small>
              </div>
              <span className={`status-pill ${row.attendance === "sim" ? "status-yes" : "status-no"}`}>
                {row.attendance === "sim" ? "Vai participar" : "Não poderá ir"}
              </span>
              <span className="response-meta">
                {row.attendance === "sim" ? `${row.adults} adulto(s) · ${row.children} criança(s)` : "—"}
              </span>
              <a className="phone-link" href={whatsappLink(row.phone)} rel="noreferrer" target="_blank">
                {row.phone}
              </a>
              <span className="response-meta response-message">{row.message || "Sem recado"}</span>
            </article>
          ))
        )}
      </section>
    </div>
  );
}

export default function ConfirmationsPage() {
  return (
    <main className="admin-page">
      <Dashboard />
    </main>
  );
}
