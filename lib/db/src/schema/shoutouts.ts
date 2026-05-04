import {
  pgTable,
  serial,
  integer,
  varchar,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const shoutoutsTable = pgTable(
  "shoutouts",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    skillId: varchar("skill_id", { length: 32 }).notNull(),
    skillTitle: varchar("skill_title", { length: 128 }).notNull(),
    branch: varchar("branch", { length: 16 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique().on(t.userId, t.skillId)],
);
