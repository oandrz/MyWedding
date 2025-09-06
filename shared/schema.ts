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
  name: text("name").notNull(),
  email: text("email").notNull(),
  attending: boolean("attending").notNull(),
  guestCount: integer("guest_count"),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertRsvpSchema = createInsertSchema(rsvp).pick({
  name: true,
  email: true,
  attending: true,
  guestCount: true,
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

export const configImages = pgTable("config_images", {
  id: serial("id").primaryKey(),
  imageKey: text("image_key").notNull().unique(), // "banner" or "gallery_default_1", etc.
  imageUrl: text("image_url").notNull(),
  imageType: text("image_type").notNull(), // "banner" or "gallery"
  title: text("title"),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull()
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

export const insertConfigImageSchema = createInsertSchema(configImages).pick({
  imageKey: true,
  imageUrl: true,
  imageType: true,
  title: true,
  description: true,
  isActive: true
});

export const featureFlags = pgTable("feature_flags", {
  id: serial("id").primaryKey(),
  featureKey: text("feature_key").notNull().unique(), // "rsvp", "messages", "gallery", etc.
  featureName: text("feature_name").notNull(), // "RSVP Form", "Message Board", etc.
  description: text("description").notNull(),
  enabled: boolean("enabled").default(true),
  updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull()
});

export const insertFeatureFlagSchema = createInsertSchema(featureFlags).pick({
  featureKey: true,
  featureName: true,
  description: true,
  enabled: true
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertRsvp = z.infer<typeof insertRsvpSchema>;
export type Rsvp = typeof rsvp.$inferSelect;
export type InsertMedia = z.infer<typeof insertMediaSchema>;
export type Media = typeof media.$inferSelect;
export type InsertConfigImage = z.infer<typeof insertConfigImageSchema>;
export type ConfigImage = typeof configImages.$inferSelect;
export type InsertFeatureFlag = z.infer<typeof insertFeatureFlagSchema>;
export type FeatureFlag = typeof featureFlags.$inferSelect;
