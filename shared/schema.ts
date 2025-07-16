import { pgTable, text, serial, integer, boolean, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const rsvp = pgTable("rsvp", {
  id: serial("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  attending: boolean("attending").notNull(),
  guestCount: integer("guest_count"),
  dietaryRestrictions: text("dietary_restrictions"),
  message: text("message"),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertRsvpSchema = createInsertSchema(rsvp).pick({
  firstName: true,
  lastName: true,
  email: true,
  attending: true,
  guestCount: true,
  dietaryRestrictions: true,
  message: true,
});

export const media = pgTable("media", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  mediaUrl: text("media_url").notNull(),
  mediaType: text("media_type").notNull(), // "image" or "video"
  caption: text("caption"),
  approved: boolean("approved").default(false),
  createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull()
});

export const insertMediaSchema = createInsertSchema(media).pick({
  name: true,
  email: true,
  mediaUrl: true,
  mediaType: true,
  caption: true
}).extend({
  mediaType: z.string().optional() // Make mediaType optional since we auto-detect it
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertRsvp = z.infer<typeof insertRsvpSchema>;
export type Rsvp = typeof rsvp.$inferSelect;
export type InsertMedia = z.infer<typeof insertMediaSchema>;
export type Media = typeof media.$inferSelect;
