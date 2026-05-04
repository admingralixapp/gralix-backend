import {
  pgTable,
  serial,
  integer,
  varchar,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

/**
 * Tracks all friend relationships.
 * status: "pending" | "accepted" | "rejected"
 *
 * A single accepted row represents a bidirectional friendship —
 * the social routes treat fromUserId ↔ toUserId symmetrically when querying.
 */
export const friendRequestsTable = pgTable(
  "friend_requests",
  {
    id:         serial("id").primaryKey(),
    fromUserId: integer("from_user_id").notNull().references(() => usersTable.id),
    toUserId:   integer("to_user_id").notNull().references(() => usersTable.id),
    status:     varchar("status", { length: 16 }).notNull().default("pending"),
    createdAt:  timestamp("created_at",  { withTimezone: true }).notNull().defaultNow(),
    updatedAt:  timestamp("updated_at",  { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_friend_pair").on(t.fromUserId, t.toUserId),
  ],
);

export type FriendRequest = typeof friendRequestsTable.$inferSelect;
