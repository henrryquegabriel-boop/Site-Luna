"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { Attendance, Invitation } from "../lib/invitations";
import { clientFetch } from "../lib/client-fetch";

export function RsvpForm() {
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [state, setState] = useState<"loading" | "missing" | "ready" | "sending" | "success" | "error">("loading");
  const [error, setError] = useState("");
  const [answers, setAnswers] = useState<Record<string, Attendance>>({});
  const [message, setMessage] = useState("");
  const token = useRef("");
  const sending = useRef(false);

  async function loadInvitation(signal?: AbortSignal) {
    if (signal?.aborted) return;
    setState("loading"); setError("");
    token.current = new URLSearchParams(window.location.search).get("convite") ?? "";
    if (!token.current) { setState("missing"); return; }
    try {
      if (!/^[a-f0-9]{64}$/.test(token.current)) throw new Error("Este link está incompleto ou é inválido. Peça o convite à família da Luna.");
      const response = await clientFetch("/api/convite", { headers: { Authorization: `Bearer ${token.current}` }, cache: "no-store", signal });
      const data = await response.json() as { invitation: Invitation; error?: string };
      if (!response.ok) throw new Error(data.error || "Não foi possível abrir seu convite.");
      const received = data.invitation as Invitation;
      setInvitation(received);
      setAnswers(Object.fromEntries(received.members.map((member) => [member.id, member.attendance])));
      setMessage(received.message); setState("ready");
    } catch (error) {
      if (signal?.aborted) return;
      setInvitation(null); setError(error instanceof Error ? error.message : "Verifique sua conexão e tente novamente."); setState("error");
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => loadInvitation(controller.signal));
    return () => controller.abort();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!invitation || sending.current) return;
    sending.current = true; setState("sending"); setError("");
    try {
      const response = await clientFetch("/api/convite", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token.current}` },
        body: JSON.stringify({ revision: invitation.revision, responses: invitation.members.map((member) => ({ id: member.id, attendance: answers[member.id] })), message }),
      });
      const data = await response.json() as { invitation: Invitation; error?: string };
      if (!response.ok) throw new Error(data.error || "Não foi possível registrar a resposta.");
      setInvitation(data.invitation); setState("success");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Verifique sua conexão. Você pode tentar novamente sem criar outra confirmação.");
      setState("ready");
    } finally { sending.current = false; }
  }

  if (state === "loading") return <div className="form-card family-rsvp" role="status"><p>Carregando seu convite…</p></div>;
  if (state === "missing") return (
    <div className="form-card family-rsvp">
      <p className="form-kicker">Um convite para sua família</p>
      <h3>Você tem um link especial</h3>
      <p>Para confirmar, abra o convite individual enviado ao responsável pela sua família. Nele estarão os nomes de todas as pessoas convidadas.</p>
      <p className="family-note">Ainda não recebeu? Fale com a família da Luna para pedir seu link.</p>
    </div>
  );
  if (!invitation) return <div className="form-card family-rsvp"><p className="form-error" role="alert">{error}</p><button className="secondary-button" onClick={() => void loadInvitation()} type="button">Tentar novamente</button></div>;
  if (state === "success") return (
    <div className="form-card family-rsvp success-card" role="status">
      <div className="success-icon" aria-hidden="true">✓</div>
      <p className="form-kicker">Resposta registrada</p><h3>Obrigada por responder!</h3>
      <p>{invitation.familyName}</p>
      <ul className="family-summary">{invitation.members.map((member) => <li key={member.id}><strong>{member.name}</strong><span>{member.attendance === "sim" ? "Vai participar" : "Não poderá ir"}</span></li>)}</ul>
      <p>Se os planos mudarem, você pode atualizar a resposta neste mesmo link.</p>
      <button className="secondary-button" type="button" onClick={() => setState("ready")}>Alterar minha resposta</button>
    </div>
  );
  return (
    <form className="form-card family-rsvp" onSubmit={submit} aria-busy={state === "sending"}>
      <div><p className="form-kicker">Confirmação de presença</p><h3>{invitation.familyName}</h3><p>Olá, {invitation.headName}! Conte quem vai celebrar com a Luna.</p></div>
      <p className="family-note">Este convite é válido somente para as {invitation.members.length} pessoa(s) abaixo. Marque uma resposta para cada nome.</p>
      {invitation.respondedAt && <p className="family-note">Já recebemos uma resposta. Você pode atualizá-la sem duplicar a confirmação.</p>}
      {invitation.members.map((member) => (
        <fieldset className="member-response" disabled={state === "sending"} key={member.id}>
          <legend>{member.name} <small>{member.kind === "crianca" ? "Criança" : "Adulto"}</small></legend>
          <div className="choice-row">
            {(["sim", "nao"] as const).map((value) => (
              <label className={answers[member.id] === value ? "choice selected" : "choice"} key={value}>
                <input type="radio" name={`person-${member.id}`} required value={value} checked={answers[member.id] === value} onChange={() => setAnswers((current) => ({ ...current, [member.id]: value }))} />
                {value === "sim" ? "Vai participar" : "Não poderá ir"}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <label className="field"><span>Um recadinho para a Luna <small>(opcional)</small></span><textarea maxLength={400} rows={3} value={message} disabled={state === "sending"} onChange={(event) => setMessage(event.target.value)} /></label>
      {error && <div><p className="form-error" role="alert">{error}</p><button className="secondary-button" type="button" onClick={() => void loadInvitation()}>Recarregar resposta salva</button></div>}
      <button className="submit-button" type="submit" disabled={state === "sending"}>{state === "sending" ? "Salvando…" : "Salvar resposta da família"}<span aria-hidden="true">✦</span></button>
      <p className="privacy-note">Os nomes e as respostas são usados somente para organizar a festa. Não compartilhe seu link fora da família.</p>
    </form>
  );
}
