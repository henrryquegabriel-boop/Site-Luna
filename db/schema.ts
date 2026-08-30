import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
