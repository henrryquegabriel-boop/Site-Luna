import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, sqliteView, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const rsvps = sqliteTable(
  "rsvps",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    guestName: text("guest_name").notNull(),
    attendance: text("attendance", { enum: ["sim", "nao"] }).notNull(),
    adults: integer("adults").notNull().default(0),
    children: integer("children").notNull().default(0),
    phone: text("phone").notNull(),
    message: text("message").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("idx_rsvps_created_at").on(table.createdAt)],
);

export type Rsvp = typeof rsvps.$inferSelect;

// Legacy RSVPs remain intact. Only these tables accept new responses.
export const invitationFamilies = sqliteTable("invitation_families", {
  id: text("id").primaryKey(),
  familyKey: text("family_key").notNull(),
  familyName: text("family_name").notNull(),
  headName: text("head_name").notNull(),
  token: text("token").notNull(),
  active: integer("active").notNull().default(1),
  revision: integer("revision").notNull().default(0),
  message: text("message").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  respondedAt: text("responded_at"),
}, (table) => [
  uniqueIndex("idx_invitation_families_key").on(table.familyKey),
  uniqueIndex("idx_invitation_families_token").on(table.token),
  check("invitation_family_active", sql`${table.active} IN (0, 1)`),
]);

export const invitationMembers = sqliteTable("invitation_members", {
  id: text("id").primaryKey(),
  familyId: text("family_id").notNull().references(() => invitationFamilies.id),
  name: text("name").notNull(),
  kind: text("kind", { enum: ["adulto", "crianca", "crianca_menor5", "nao_informado"] }).notNull(),
  position: integer("position").notNull(),
  attendance: text("attendance", { enum: ["pendente", "sim", "nao"] }).notNull().default("pendente"),
}, (table) => [
  index("idx_invitation_members_family").on(table.familyId, table.position),
  check("invitation_member_kind", sql`${table.kind} IN ('adulto', 'crianca', 'crianca_menor5', 'nao_informado')`),
  check("invitation_member_attendance", sql`${table.attendance} IN ('pendente', 'sim', 'nao')`),
]);

// Required business columns stay consistent with the named roster. A head
// is a contact label, never another ticket added to the member count.
export const guestInvitations = sqliteView("guest_invitations", {
  guestId: text("ID_Convidado"),
  headName: text("Nome_Chefe_Familia"),
  token: text("Token_Unico"),
  companionLimit: integer("Limite_Acompanhantes"),
  confirmationStatus: text("Status_Confirmacao"),
}).as(sql`SELECT f.id AS ID_Convidado, f.head_name AS Nome_Chefe_Familia,
  f.token AS Token_Unico,
  MAX((SELECT COUNT(*) FROM invitation_members m WHERE m.family_id = f.id) - 1, 0) AS Limite_Acompanhantes,
  CASE WHEN f.responded_at IS NULL THEN 'Pendente' ELSE 'Confirmado' END AS Status_Confirmacao
  FROM invitation_families f`);

export const invitationCorrections = sqliteTable("invitation_corrections", {
  id: text("id").primaryKey(),
  familyId: text("family_id").notNull().references(() => invitationFamilies.id),
  adminEmail: text("admin_email").notNull(),
  previousAnswers: text("previous_answers").notNull(),
  newAnswers: text("new_answers").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_invitation_corrections_family").on(table.familyId, table.createdAt)]);
