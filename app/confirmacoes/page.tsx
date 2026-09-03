import { chatGPTSignOutPath, requireChatGPTUser } from "../chatgpt-auth";
import { getAllowedAdminEmails } from "../admin-emails";
import { getRawDb } from "../../db";
import { FamilyManager } from "./FamilyManager";
import Link from "next/link";

export const dynamic = "force-dynamic";

async function Dashboard() {
  const user = await requireChatGPTUser("/confirmacoes");
  if (!getAllowedAdminEmails().includes(user.email.toLowerCase())) return (
    <div className="access-denied"><p className="eyebrow">Área reservada</p><h1>Acesso não autorizado</h1><p>Esta página é exclusiva para os administradores da festa.</p><a className="admin-link" href={chatGPTSignOutPath("/")}>Sair e voltar ao convite</a></div>
  );
  const legacy = await getRawDb().prepare("SELECT COUNT(*) AS total FROM rsvps").first<{ total: number }>();
  return (
    <div className="admin-shell family-admin">
      <header className="admin-header">
        <div><p className="eyebrow">Festa de 1 ano da Luna</p><h1>Famílias e confirmações</h1><p>Cadastre os convidados e envie um link exclusivo para cada responsável.</p></div>
        <nav className="admin-actions" aria-label="Administração"><Link className="admin-link" href="/">Ver convite</Link><a className="admin-link" href={chatGPTSignOutPath("/")}>Sair</a></nav>
      </header>
      <FamilyManager />
      <details className="legacy-panel">
        <summary>Respostas do formulário antigo ({legacy?.total ?? 0})</summary>
        <p>Preservadas para conferência. Como não identificavam cada acompanhante, não entram no total da nova lista. Cadastre essas famílias e envie seus links individuais para uma nova confirmação.</p>
        <a className="admin-link" href="/api/confirmacoes/exportar?historico=1">Baixar respostas antigas</a>
      </details>
    </div>
  );
}
export default function ConfirmationsPage() { return <main className="admin-page"><Dashboard /></main>; }
