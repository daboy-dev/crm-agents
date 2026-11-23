import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

/** Key/value metadata about the app itself. Used by the health check. */
export const appMeta = pgTable("app_meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
