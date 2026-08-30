import { getDb, ensureRsvpSchema } from "../../../db";
import { rsvps } from "../../../db/schema";

const NAME_LIMIT = 100;
const PHONE_LIMIT = 24;
const MESSAGE_LIMIT = 400;

function cleanText(value: unknown, limit: number) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

function integerInRange(value: unknown, min: number, max: number) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isInteger(number) && number >= min && number <= max
    ? number
    : null;
}

export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) {
      return Response.json({ error: "Origem não permitida." }, { status: 403 });
    }

    const payload = (await request.json()) as Record<string, unknown>;

    // Campo invisível: robôs costumam preenchê-lo, pessoas não.
    if (cleanText(payload.website, 100)) {
      return Response.json({ ok: true }, { status: 201 });
    }

    const guestName = cleanText(payload.guestName, NAME_LIMIT);
    const phone = cleanText(payload.phone, PHONE_LIMIT);
    const message = cleanText(payload.message, MESSAGE_LIMIT);
    const attendance = payload.attendance === "nao" ? "nao" : payload.attendance === "sim" ? "sim" : null;
    const adults = attendance === "sim" ? integerInRange(payload.adults, 1, 20) : 0;
    const children = attendance === "sim" ? integerInRange(payload.children, 0, 20) : 0;
    const phoneDigits = phone.replace(/\D/g, "");

    if (!guestName) {
      return Response.json({ error: "Informe o nome do convidado ou da família." }, { status: 400 });
    }
    if (!attendance) {
      return Response.json({ error: "Informe se você poderá estar presente." }, { status: 400 });
    }
    if (adults === null || children === null) {
      return Response.json({ error: "Revise a quantidade de convidados." }, { status: 400 });
    }
    if (phoneDigits.length < 8) {
      return Response.json({ error: "Informe um WhatsApp válido para contato." }, { status: 400 });
    }

    await ensureRsvpSchema();
    const db = getDb();
    const [confirmation] = await db
      .insert(rsvps)
      .values({
        guestName,
        attendance,
        adults,
        children,
        phone,
        message,
      })
      .returning({ id: rsvps.id });

    return Response.json({ ok: true, confirmationId: confirmation.id }, { status: 201 });
  } catch {
    return Response.json(
      { error: "Não foi possível registrar agora. Aguarde um instante e tente novamente." },
      { status: 500 },
    );
  }
}
