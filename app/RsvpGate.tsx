import { getRawDb } from "../db";
import { getInvitation, guestView } from "../lib/invitation-store";
import { InvitationError, type GuestInvitation } from "../lib/invitations";
import { RsvpForm } from "./RsvpForm";
import { ConfirmationReceipt } from "./ConfirmationReceipt";

export type InvitationSearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function RsvpGate({ searchParams }: { searchParams?: InvitationSearchParams }) {
  const params = searchParams ? await searchParams : {};
  const token = params.token ?? params.convite;
  if (!token) return (
    <div className="form-card family-rsvp" data-rsvp-state="missing">
      <p className="form-kicker">Um convite para sua família</p><h3>Você tem um link especial</h3>
      <p>Abra o link individual enviado ao responsável da sua família para confirmar as pessoas convidadas.</p>
      <p>Ainda não recebeu? Peça seu link à família da Luna.</p>
    </div>
  );
  let invitation: GuestInvitation | undefined;
  let failure: string | undefined;
  try {
    if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) throw new InvitationError("Este link está incompleto ou é inválido. Peça seu convite à família da Luna.", 404);
    invitation = guestView(await getInvitation(getRawDb(), token));
  } catch (error) {
    failure = error instanceof InvitationError ? error.message : "Não foi possível carregar seu convite agora. Recarregue a página em instantes.";
  }
  if (!invitation || typeof token !== "string") return <div className="form-card family-rsvp" data-rsvp-state="unavailable">
    <p className="form-error" role="alert">{failure}</p>
  </div>;
  // Completed and invalid tokens never instantiate or serialize the form.
  if (invitation.status === "Confirmado") return <ConfirmationReceipt anyAttending={invitation.anyAttending} />;
  return <RsvpForm invitation={invitation} token={token} />;
}
