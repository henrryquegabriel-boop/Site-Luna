"use client";

import { useRef, useState } from "react";
import type { FormEvent } from "react";
import type { Attendance, GuestInvitation, PendingInvitation } from "../lib/invitations";
import { kindLabels } from "../lib/invitations";
import { clientFetch } from "../lib/client-fetch";
import { ConfirmationReceipt } from "./ConfirmationReceipt";

export function RsvpForm({ invitation, token }: { invitation: PendingInvitation; token: string }) {
  const [state, setState] = useState<"ready" | "review" | "sending" | "confirmed">("ready");
  const [error, setError] = useState("");
  const [answers, setAnswers] = useState<Record<string, Attendance>>(
    Object.fromEntries(invitation.members.map((member) => [member.id, member.attendance])),
  );
  const [message, setMessage] = useState("");
  const [anyAttending, setAnyAttending] = useState(false);
  const sending = useRef(false);

  function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setState("review");
  }
  async function submit() {
    if (sending.current) return;
    sending.current = true; setState("sending"); setError("");
    try {
      const response = await clientFetch("/api/convite", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ revision: invitation.revision, responses: invitation.members.map((member) => ({ id: member.id, attendance: answers[member.id] })), message }),
      });
      const data = await response.json() as { invitation?: GuestInvitation; error?: string; code?: string };
      if (data.code === "ALREADY_CONFIRMED") {
        // A saved response from another tab wins. Reload the authoritative server gate.
        window.location.reload(); return;
      }
      if (!response.ok || data.invitation?.status !== "Confirmado") throw new Error(data.error || "Não foi possível registrar sua resposta.");
      setAnyAttending(data.invitation.anyAttending); setState("confirmed");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Verifique sua conexão. Recarregue a página para consultar se a resposta foi salva.");
      setState("review");
    } finally { sending.current = false; }
  }

  if (state === "confirmed") return <ConfirmationReceipt anyAttending={anyAttending} />;

  if (state === "review" || state === "sending") return (
    <div className="form-card family-rsvp" aria-busy={state === "sending"}>
      <p className="form-kicker">Confira antes de enviar</p><h3>{invitation.familyName}</h3>
      <ul className="family-summary">{invitation.members.map((member) => <li key={member.id}><strong>{member.name}</strong><span>{answers[member.id] === "sim" ? "Vai participar" : "Não poderá ir"}</span></li>)}</ul>
      <p>Após confirmar, alterações deverão ser solicitadas diretamente aos pais da Luna.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="submit-button" disabled={state === "sending"} onClick={() => void submit()} type="button">{state === "sending" ? "Salvando…" : "Confirmar resposta definitiva"}</button>
      <button className="secondary-button" disabled={state === "sending"} onClick={() => setState("ready")} type="button">Voltar e revisar</button>
      {error && <button className="secondary-button" type="button" onClick={() => window.location.reload()}>Consultar resposta salva</button>}
    </div>
  );

  return (
    <form className="form-card family-rsvp" onSubmit={review} data-rsvp-state="pending">
      <div><p className="form-kicker">Confirmação de presença</p><h3>{invitation.familyName}</h3><p>Olá, {invitation.headName}! Conte quem vai celebrar com a Luna.</p></div>
      <p className="family-note">Seu convite inclui exatamente {invitation.totalGuests} pessoa(s), já listadas abaixo. Responda por cada nome.</p>
      {invitation.members.map((member) => (
        <fieldset className="member-response" key={member.id}>
          <legend>{member.name}{member.kind !== "nao_informado" && <small>{kindLabels[member.kind]}</small>}</legend>
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
      <label className="field"><span>Um recadinho para a Luna <small>(opcional)</small></span><textarea maxLength={400} rows={3} value={message} onChange={(event) => setMessage(event.target.value)} /></label>
      <button className="submit-button" type="submit">Revisar minha resposta<span aria-hidden="true">✦</span></button>
      <p className="privacy-note">Cada convite aceita uma resposta. Envie seu link apenas às pessoas da sua família.</p>
    </form>
  );
}
