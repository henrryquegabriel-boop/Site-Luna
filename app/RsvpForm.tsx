"use client";

import { FormEvent, useState } from "react";

type SubmitState = "idle" | "sending" | "success" | "error";

export function RsvpForm() {
  const [attendance, setAttendance] = useState<"sim" | "nao">("sim");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitState("sending");
    setErrorMessage("");

    const form = event.currentTarget;
    const data = new FormData(form);

    try {
      const response = await fetch("/api/confirmacoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guestName: data.get("guestName"),
          attendance,
          adults: attendance === "sim" ? Number(data.get("adults")) : 0,
          children: attendance === "sim" ? Number(data.get("children")) : 0,
          phone: data.get("phone"),
          message: data.get("message"),
          website: data.get("website"),
        }),
      });

      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error || "Não foi possível registrar sua resposta.");
      }

      setSubmitState("success");
      form.reset();
      setAttendance("sim");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível registrar sua resposta.",
      );
      setSubmitState("error");
    }
  }

  if (submitState === "success") {
    return (
      <div className="form-card success-card" role="status">
        <div className="success-icon" aria-hidden="true">✓</div>
        <p className="form-kicker">Resposta registrada</p>
        <h3>Obrigada por responder!</h3>
        <p>
          Sua confirmação chegou direitinho. Estamos muito felizes em dividir
          esse momento com você.
        </p>
        <button
          className="secondary-button"
          type="button"
          onClick={() => setSubmitState("idle")}
        >
          Enviar outra resposta
        </button>
      </div>
    );
  }

  return (
    <form className="form-card" onSubmit={handleSubmit}>
      <p className="form-kicker">Confirmação de presença</p>

      <label className="field full-field">
        <span>Nome do convidado ou família</span>
        <input
          autoComplete="name"
          maxLength={100}
          name="guestName"
          placeholder="Ex.: Família Oliveira"
          required
        />
      </label>

      <fieldset className="attendance-field">
        <legend>Você poderá estar presente?</legend>
        <div className="choice-row">
          <label className={attendance === "sim" ? "choice selected" : "choice"}>
            <input
              checked={attendance === "sim"}
              name="attendance"
              onChange={() => setAttendance("sim")}
              type="radio"
              value="sim"
            />
            <span aria-hidden="true">♡</span>
            Sim, estarei lá!
          </label>
          <label className={attendance === "nao" ? "choice selected" : "choice"}>
            <input
              checked={attendance === "nao"}
              name="attendance"
              onChange={() => setAttendance("nao")}
              type="radio"
              value="nao"
            />
            Não poderei ir
          </label>
        </div>
      </fieldset>

      {attendance === "sim" && (
        <div className="guest-counts">
          <label className="field">
            <span>Adultos</span>
            <input defaultValue={1} max={20} min={1} name="adults" required type="number" />
          </label>
          <label className="field">
            <span>Crianças</span>
            <input defaultValue={0} max={20} min={0} name="children" required type="number" />
          </label>
        </div>
      )}

      <label className="field full-field">
        <span>WhatsApp para contato</span>
        <input
          autoComplete="tel"
          inputMode="tel"
          maxLength={24}
          name="phone"
          placeholder="(00) 00000-0000"
          required
          type="tel"
        />
      </label>

      <label className="field full-field">
        <span>Deixe um recadinho <small>(opcional)</small></span>
        <textarea
          maxLength={400}
          name="message"
          placeholder="Escreva uma mensagem para a Luna..."
          rows={3}
        />
      </label>

      <label className="honeypot" aria-hidden="true">
        Website
        <input autoComplete="off" name="website" tabIndex={-1} />
      </label>

      {submitState === "error" && (
        <p className="form-error" role="alert">{errorMessage}</p>
      )}

      <button className="submit-button" disabled={submitState === "sending"} type="submit">
        {submitState === "sending" ? "Registrando..." : "Confirmar minha resposta"}
        <span aria-hidden="true">✦</span>
      </button>
      <p className="privacy-note">
        Seus dados serão usados somente para a organização da festa.
      </p>
    </form>
  );
}
