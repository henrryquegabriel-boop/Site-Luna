"use client";

import { useRef, useState } from "react";
import type { FormEvent } from "react";
import type { AdminInvitation, Attendance } from "../../lib/invitations";
import { clientFetch } from "../../lib/client-fetch";

export function FamilyCorrection({ family, onSaved }: { family: AdminInvitation; onSaved: () => Promise<void> }) {
  const [answers, setAnswers] = useState<Record<string, Attendance>>(Object.fromEntries(family.members.map((member) => [member.id, member.attendance])));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const response = await clientFetch("/api/familias/corrigir", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: family.id, answer: { revision: family.revision, message: family.message, responses: family.members.map((member) => ({ id: member.id, attendance: answers[member.id] })) } }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Não foi possível corrigir a resposta.");
      await onSaved();
    } catch (error) { setError(error instanceof Error ? error.message : "Verifique a conexão e atualize a lista."); }
    finally { lock.current = false; setBusy(false); }
  }
  return <details className="family-correction">
    <summary>Corrigir presenças como administrador</summary>
    <form onSubmit={save} className="family-create">
      <p>A correção fica registrada com a conta de quem a realizou. O formulário do convidado continua encerrado.</p>
      {family.members.map((member) => <label className="field" key={member.id}><span>{member.name}</span><select disabled={busy} value={answers[member.id]} onChange={(event) => setAnswers((current) => ({ ...current, [member.id]: event.target.value as Attendance }))}><option value="sim">Vai participar</option><option value="nao">Não poderá ir</option></select></label>)}
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="submit-button" type="submit" disabled={busy}>{busy ? "Salvando…" : "Salvar correção"}</button>
    </form>
  </details>;
}
