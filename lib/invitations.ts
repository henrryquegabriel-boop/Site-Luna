export type Attendance = "pendente" | "sim" | "nao";
export const kindLabels = { adulto: "Adulto", crianca: "Criança", crianca_menor5: "Criança menor de 5 anos", nao_informado: "Faixa não informada" } as const;
export type MemberInput = { name: string; kind: keyof typeof kindLabels };
export type FamilyInput = { familyName: string; headName: string; members: MemberInput[] };
export type InvitationMember = MemberInput & { id: string; attendance: Attendance };
export type Invitation = {
  id: string; familyName: string; headName: string; revision: number;
  message: string; respondedAt: string | null; members: InvitationMember[];
  status: "Pendente" | "Confirmado"; companionLimit: number; totalGuests: number;
};
export type AdminInvitation = Invitation & { token: string; active: boolean };
export type ConfirmedInvitation = { status: "Confirmado"; anyAttending: boolean };
export type PendingInvitation = Invitation & { status: "Pendente" };
export type GuestInvitation = PendingInvitation | ConfirmedInvitation;
export const CONFIRMED_MESSAGE = "Sua presença (e de sua família) já foi confirmada! Caso precise fazer alterações, entre em contato diretamente com os pais.";
export const DECLINED_MESSAGE = "Sua resposta (e de sua família) já foi registrada! Caso precise fazer alterações, entre em contato diretamente com os pais.";

export class InvitationError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status = 400, code?: string) { super(message); this.status = status; this.code = code; }
}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new InvitationError("Dados inválidos.");
  return value as Record<string, unknown>;
}
export function textValue(value: unknown, label: string, max: number, optional = false): string {
  if (typeof value !== "string") throw new InvitationError(`Revise ${label}.`);
  const result = value.trim().normalize("NFC");
  if ((!optional && !result) || result.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(result)) throw new InvitationError(`Revise ${label} (até ${max} caracteres).`);
  return result;
}
export function familyKey(value: string) { return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR"); }
export function validateFamilies(value: unknown): FamilyInput[] {
  if (!Array.isArray(value) || !value.length || value.length > 100) throw new InvitationError("Cadastre de 1 a 100 famílias por vez.");
  const keys = new Set<string>(); let total = 0;
  const families = value.map((item) => {
    const row = object(item);
    const familyName = textValue(row.familyName, "o nome da família", 100);
    const headName = textValue(row.headName, "o responsável", 100);
    const key = familyKey(familyName);
    if (keys.has(key)) throw new InvitationError(`A família ${familyName} aparece mais de uma vez.`);
    keys.add(key);
    if (!Array.isArray(row.members) || !row.members.length || row.members.length > 30) throw new InvitationError(`Informe de 1 a 30 pessoas para ${familyName}.`);
    const names = new Set<string>();
    const members = row.members.map((item) => {
      const person = object(item); const name = textValue(person.name, "o nome do convidado", 100);
      if (names.has(familyKey(name))) throw new InvitationError(`Há nomes repetidos em ${familyName}. Use nomes completos para diferenciá-los.`);
      names.add(familyKey(name));
      if (typeof person.kind !== "string" || !Object.hasOwn(kindLabels, person.kind)) throw new InvitationError(`Revise a faixa etária de ${name}.`);
      return { name, kind: person.kind } as MemberInput;
    });
    total += members.length;
    return { familyName, headName, members };
  });
  if (total > 300) throw new InvitationError("Importe no máximo 300 pessoas por vez. Divida a lista em arquivos menores.");
  return families;
}
export function validateResponse(value: unknown, members: InvitationMember[]) {
  const row = object(value);
  if (Object.keys(row).some((key) => !["revision", "responses", "message"].includes(key))) throw new InvitationError("Somente as pessoas cadastradas neste convite podem confirmar presença.");
  if (!Number.isSafeInteger(row.revision) || Number(row.revision) < 0) throw new InvitationError("Reabra o convite para atualizar a resposta.");
  if (!Array.isArray(row.responses) || row.responses.length !== members.length) throw new InvitationError("Responda por todas as pessoas deste convite.");
  const allowed = new Set(members.map((member) => member.id)); const seen = new Set<string>();
  const responses = row.responses.map((item) => {
    const answer = object(item);
    if (Object.keys(answer).some((key) => !["id", "attendance"].includes(key)) || typeof answer.id !== "string" || !allowed.has(answer.id) || seen.has(answer.id)) throw new InvitationError("A resposta contém uma pessoa que não pertence a este convite ou está repetida.");
    seen.add(answer.id);
    if (answer.attendance !== "sim" && answer.attendance !== "nao") throw new InvitationError("Escolha se cada pessoa vai ou não poderá ir.");
    return { id: answer.id, attendance: answer.attendance as "sim" | "nao" };
  });
  return { revision: row.revision as number, responses, message: textValue(row.message ?? "", "o recado", 400, true) };
}
export function createToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
export function invitePath(token: string) { return `/?token=${encodeURIComponent(token)}`; }
export function csvCell(value: unknown) {
  let text = String(value ?? "");
  // Prevent spreadsheet formulas from untrusted guest names and messages.
  if (/^[\s]*[=+@-]|^[\t\r\n]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
export function parseGuestCsv(source: string): FamilyInput[] {
  if (source.length > 100_000) throw new InvitationError("O arquivo é muito grande. Divida a lista em arquivos menores.");
  const text = source.replace(/^\uFEFF/, ""); const delimiter = text.split(/\r?\n/, 1)[0].includes(";") ? ";" : ",";
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
      else if (quoted || !cell.length) quoted = !quoted;
      else throw new InvitationError("Aspas inválidas no CSV.");
    } else if (!quoted && (char === delimiter || char === "\n" || char === "\r")) {
      row.push(cell.trim()); cell = "";
      if (char !== delimiter) { if (row.some(Boolean)) rows.push(row); row = []; if (char === "\r" && text[i + 1] === "\n") i++; }
    } else cell += char;
  }
  if (quoted) throw new InvitationError("Há aspas não fechadas no CSV.");
  row.push(cell.trim()); if (row.some(Boolean)) rows.push(row);
  const header = rows.shift()?.map((column) => familyKey(column).normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
  if (!header || header.join(",") !== "familia,responsavel,nome,tipo") throw new InvitationError("Use as colunas, nesta ordem: familia;responsavel;nome;tipo.");
  const groups = new Map<string, FamilyInput>();
  rows.forEach((columns, index) => {
    if (columns.length !== 4) throw new InvitationError(`Revise a linha ${index + 2}: são necessárias quatro colunas.`);
    const [familyName, headName, name, rawKind] = columns; const key = familyKey(familyName);
    const group = groups.get(key) ?? { familyName, headName, members: [] };
    if (familyKey(group.headName) !== familyKey(headName)) throw new InvitationError(`Use o mesmo responsável em todas as linhas de ${familyName}.`);
    const kind = familyKey(rawKind).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    group.members.push({ name, kind: kind as MemberInput["kind"] }); groups.set(key, group);
  });
  return validateFamilies([...groups.values()]);
}
