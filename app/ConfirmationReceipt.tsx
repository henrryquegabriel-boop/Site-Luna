import { CONFIRMED_MESSAGE, DECLINED_MESSAGE } from "../lib/invitations";

export function ConfirmationReceipt({ anyAttending }: { anyAttending: boolean }) {
  return (
    <div className="form-card family-rsvp confirmation-receipt" role="status" data-rsvp-state="confirmed">
      <div className="success-icon" aria-hidden="true">✓</div>
      <p className="form-kicker">Resposta registrada</p>
      <p>{anyAttending ? CONFIRMED_MESSAGE : DECLINED_MESSAGE}</p>
    </div>
  );
}
