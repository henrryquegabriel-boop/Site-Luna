"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { invitePath, kindLabels, parseGuestCsv, validateFamilies } from "../../lib/invitations";
import type { AdminInvitation, FamilyInput, MemberInput } from "../../lib/invitations";
import { clientFetch } from "../../lib/client-fetch";
import { FamilyCorrection } from "./FamilyCorrection";

const statusLabel = { pendente: "Pendente", sim: "Vai participar", nao: "Não poderá ir" };

export function FamilyManager() {
  const [families, setFamilies] = useState<AdminInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [headName, setHeadName] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [members, setMembers] = useState<MemberInput[]>([{ name: "", kind: "nao_informado" }]);
  const [preview, setPreview] = useState<FamilyInput[] | null>(null);
  const [manualLink, setManualLink] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const actionLock = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function refresh(signal?: AbortSignal) {
    if (signal?.aborted) return;
    try {
      const response = await clientFetch("/api/familias", { cache: "no-store", signal });
      const data = await response.json() as { families: AdminInvitation[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Não foi possível carregar as famílias.");
      setFamilies(data.families); setLoading(false);
    } catch (error) {
      if (signal?.aborted) return;
      setError(error instanceof Error ? error.message : "Verifique sua conexão e tente novamente."); setLoading(false);
      throw error;
    }
  }
  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => refresh(controller.signal)).catch(() => {});
    return () => controller.abort();
  }, []);
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible" && !actionLock.current) void refresh().catch(() => {});
    }, 30_000);
    return () => clearInterval(timer);
  }, []);

  async function saveFamilies(value: FamilyInput[]) {
    if (actionLock.current) return false;
    actionLock.current = true; setBusy(true); setError(""); setNotice("");
    try {
      const response = await clientFetch("/api/familias", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ families: validateFamilies(value) }) });
      const result = await response.json() as { created: number; skipped: string[]; error?: string };
      if (!response.ok) throw new Error(result.error || "Não foi possível cadastrar.");
      setNotice(`${result.created} família(s) cadastrada(s).${result.skipped.length ? " Já existentes, mantidas sem alteração: " + result.skipped.join(", ") + "." : ""}`);
      await refresh(); return true;
    } catch (error) { setError(error instanceof Error ? error.message : "Não foi possível salvar. Atualize a lista antes de tentar novamente."); return false; }
    finally { actionLock.current = false; setBusy(false); }
  }

  async function addFamily(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const saved = await saveFamilies([{ familyName, headName, members }]);
    if (saved) { setFamilyName(""); setHeadName(""); setMembers([{ name: "", kind: "nao_informado" }]); }
  }
  async function readFile(file?: File) {
    setPreview(null); setError("");
    if (!file) return;
    try {
      if (file.size > 100_000) throw new Error("O arquivo é muito grande. Divida a lista em arquivos menores.");
      setPreview(parseGuestCsv(await file.text()));
    } catch (error) { setError(error instanceof Error ? error.message : "Não foi possível ler o CSV."); }
  }
  async function manage(family: AdminInvitation, action: "rotate" | "enable" | "disable") {
    const prompt = action === "rotate" ? "Gerar um novo link? O anterior deixará de funcionar, mas as respostas serão preservadas." : action === "disable" ? "Desativar este convite? As respostas serão preservadas e sairão dos totais ativos." : "";
    if ((prompt && !window.confirm(prompt)) || actionLock.current) return;
    actionLock.current = true; setBusy(true); setError(""); setNotice(""); setManualLink("");
    try {
      const response = await clientFetch("/api/familias", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: family.id, revision: family.revision, action }) });
      const data = await response.json() as { error?: string }; if (!response.ok) throw new Error(data.error);
      await refresh(); setNotice(action === "rotate" ? "Novo link gerado. Copie e envie somente ao responsável." : "Convite atualizado.");
    } catch (error) { setError(error instanceof Error ? error.message : "Não foi possível atualizar o convite."); }
    finally { actionLock.current = false; setBusy(false); }
  }
  async function copyLink(family: AdminInvitation) {
    const url = new URL(invitePath(family.token), window.location.origin).href;
    setManualLink(""); setNotice("");
    try { await navigator.clipboard.writeText(url); setNotice(`Link de ${family.familyName} copiado.`); }
    catch { setManualLink(url); setNotice("Selecione e copie o link abaixo."); }
  }
  const active = families.filter((family) => family.active);
  const people = active.flatMap((family) => family.members);
  const yes = people.filter((person) => person.attendance === "sim");
  const shown = families.filter((family) => (!statusFilter || family.status === statusFilter)
    && [family.familyName, family.headName, ...family.members.map((member) => member.name)].join(" ").toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR")));

  return (
    <div className="family-management">
      <section className="stats-grid" aria-label="Resumo dos convites ativos">
        <article className="stat-card"><span>Famílias ativas</span><strong>{active.length}</strong><small>{people.length} pessoas na lista</small></article>
        <article className="stat-card"><span>Pessoas que vão</span><strong>{yes.length}</strong><small>{yes.filter((person) => person.kind === "adulto").length} adultos · {yes.filter((person) => person.kind.startsWith("crianca")).length} crianças · {yes.filter((person) => person.kind === "nao_informado").length} sem faixa</small></article>
        <article className="stat-card"><span>Aguardando resposta</span><strong>{people.filter((person) => person.attendance === "pendente").length}</strong><small>pessoas</small></article>
        <article className="stat-card"><span>Não poderão ir</span><strong>{people.filter((person) => person.attendance === "nao").length}</strong><small>pessoas</small></article>
        <article className="stat-card"><span>Convites respondidos</span><strong>{active.filter((family) => family.status === "Confirmado").length}</strong><small>respostas definitivas</small></article>
        <article className="stat-card"><span>Convites pendentes</span><strong>{active.filter((family) => family.status === "Pendente").length}</strong><small>famílias que faltam responder</small></article>
      </section>
      <p className="family-note">Cada convite aceita uma única resposta pelos nomes cadastrados. Depois do envio, somente vocês podem corrigir as presenças. O painel atualiza as respostas a cada 30 segundos enquanto estiver aberto.</p>
      <div className="admin-actions">
        <button className="admin-link" type="button" disabled={busy} onClick={() => { setError(""); void refresh().catch(() => {}); }}>Atualizar respostas</button>
        <a className="admin-link" href="/api/confirmacoes/exportar">Baixar confirmações</a>
        <a className="admin-link" href="/api/confirmacoes/exportar?links=1">Baixar links das famílias</a>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {notice && <p className="admin-notice" role="status">{notice}</p>}
      {manualLink && <label className="field"><span>Link individual</span><input readOnly value={manualLink} onFocus={(event) => event.target.select()} /></label>}
      <div className="family-tools">
        <details className="family-tool">
          <summary>Cadastrar uma família</summary>
          <form onSubmit={addFamily} className="family-create">
            <label className="field"><span>Nome para identificar a família</span><input required maxLength={100} value={familyName} onChange={(event) => setFamilyName(event.target.value)} placeholder="Ex.: Família do Gabriel" /></label>
            <label className="field"><span>Nome do responsável</span><input required maxLength={100} value={headName} onChange={(event) => setHeadName(event.target.value)} placeholder="Nome completo" /></label>
            <p>Liste todas as pessoas convidadas, incluindo o responsável uma única vez. O nome do responsável acima identifica quem recebe o link e não acrescenta um lugar à lista.</p>
            {members.map((member, index) => <div className="member-editor" key={index}>
              <label className="field"><span>Convidado {index + 1}</span><input required maxLength={100} value={member.name} onChange={(event) => setMembers((current) => current.map((person, i) => i === index ? { ...person, name: event.target.value } : person))} /></label>
              <label className="field"><span>Faixa</span><select value={member.kind} onChange={(event) => setMembers((current) => current.map((person, i) => i === index ? { ...person, kind: event.target.value as MemberInput["kind"] } : person))}>{Object.entries(kindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <button type="button" className="admin-link" disabled={members.length <= 1} aria-label={`Remover convidado ${index + 1}`} onClick={() => setMembers((current) => current.filter((_, i) => i !== index))}>Remover</button>
            </div>)}
            <button type="button" className="admin-link" disabled={members.length >= 30 || busy} onClick={() => setMembers((current) => [...current, { name: "", kind: "nao_informado" }])}>+ Adicionar pessoa à lista</button>
            <button type="submit" className="submit-button" disabled={busy}>{busy ? "Salvando…" : "Cadastrar e gerar convite"}</button>
          </form>
        </details>
        <details className="family-tool">
          <summary>Importar lista de convidados</summary>
          <div className="family-create">
            <p>Use um CSV com uma pessoa por linha, incluindo o responsável somente na sua própria linha. Repita a identificação da família e do responsável. Até 100 famílias e 300 pessoas por arquivo.</p>
            <a className="admin-link" href="/modelo-convidados.csv" download>Baixar modelo CSV</a>
            <label className="field"><span>Arquivo CSV (UTF-8)</span><input ref={fileInput} type="file" accept=".csv,text/csv" disabled={busy} onChange={(event) => void readFile(event.target.files?.[0])} /></label>
            {preview && <div className="import-preview">
              <h3>Revise antes de importar</h3>
              <p>{preview.length} famílias · {preview.reduce((total, family) => total + family.members.length, 0)} pessoas no total</p>
              {preview.map((family) => <p key={family.familyName}><strong>{family.familyName} ({family.members.length} lugares)</strong> · {family.members.map((member) => member.name).join(", ")}</p>)}
              <p>Famílias com o mesmo nome já cadastrado serão ignoradas, sem alterar nomes, links ou respostas. Use identificações diferentes para famílias homônimas.</p>
              <button className="submit-button" type="button" disabled={busy} onClick={async () => { if (await saveFamilies(preview)) { setPreview(null); if (fileInput.current) fileInput.current.value = ""; } }}>Importar {preview.length} família(s)</button>
            </div>}
          </div>
        </details>
      </div>
      <div className="family-filters">
        <label className="field"><span>Buscar família ou convidado</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        <label className="field"><span>Status do convite</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">Todos</option><option value="Pendente">Pendentes</option><option value="Confirmado">Confirmados</option></select></label>
      </div>
      <section className="family-list" aria-label="Famílias cadastradas" aria-busy={loading || busy}>
        {loading ? <p role="status">Carregando famílias…</p> : families.length === 0 ? <p className="empty-state">Nenhuma família cadastrada. Cadastre ou importe a lista acima para gerar os primeiros convites.</p> : shown.length === 0 ? <p>Nenhuma família encontrada com este filtro.</p> : shown.map((family) => (
          <article className="family-card" key={family.id}>
            <header><div><h2>{family.familyName}</h2><p>Responsável: {family.headName}</p></div><span className={`status-pill ${family.active ? "status-yes" : "status-no"}`}>{family.active ? "Ativo" : "Desativado"}</span></header>
            <p><strong>{family.status}</strong> · {family.totalGuests} lugares no total · {family.companionLimit} acompanhante(s) além do responsável</p>
            <ul className="family-summary">{family.members.map((member) => <li key={member.id}><div><strong>{member.name}</strong><small>{kindLabels[member.kind]}</small></div><span className={`status-pill ${member.attendance === "sim" ? "status-yes" : member.attendance === "nao" ? "status-no" : "status-pending"}`}>{statusLabel[member.attendance]}</span></li>)}</ul>
            {family.respondedAt && <p>Resposta enviada em: {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(family.respondedAt.replace(" ", "T") + "Z"))}</p>}
            {family.message && <p className="family-message">Recado: {family.message}</p>}
            <div className="admin-actions">
              {family.active && <><button type="button" disabled={busy} className="admin-link" onClick={() => void copyLink(family)}>Copiar convite</button><a className="admin-link" href={invitePath(family.token)} target="_blank" rel="noreferrer">Abrir convite</a></>}
              <button type="button" disabled={busy} className="admin-link" onClick={() => void manage(family, "rotate")}>Trocar link</button>
              <button type="button" disabled={busy} className="admin-link" onClick={() => void manage(family, family.active ? "disable" : "enable")}>{family.active ? "Desativar" : "Reativar"}</button>
            </div>
            {family.status === "Confirmado" && <FamilyCorrection key={family.revision} family={family} onSaved={refresh} />}
          </article>
        ))}
      </section>
    </div>
  );
}
