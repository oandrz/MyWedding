import { pgTable, text, serial, integer, boolean, date, timestamp, jsonb } from "drizzle-orm/pg-core";
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

export const appSettings = pgTable("app_settings", {
  id: serial("id").primaryKey(),
  settingKey: text("setting_key").notNull().unique(), // "background_music_url", etc.
  settingValue: text("setting_value").notNull(),
  settingType: text("setting_type").notNull(), // "audio", "text", "number", etc.
  description: text("description"),
  updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull()
});

export const insertFeatureFlagSchema = createInsertSchema(featureFlags).pick({
  featureKey: true,
  featureName: true,
  description: true,
  enabled: true
});

export const insertAppSettingSchema = createInsertSchema(appSettings).pick({
  settingKey: true,
  settingValue: true,
  settingType: true,
  description: true
});

export const welcomeScreen = pgTable("welcome_screen", {
  id: serial("id").primaryKey(),
  headingText: text("heading_text").notNull().default("The Wedding of Andreas & Christine"),
  deliveryLabel: text("delivery_label").notNull().default("Kindly Delivered to"),
  fallbackName: text("fallback_name").notNull().default("Our Dearest Guest"),
  enabled: boolean("enabled").default(true),
  updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull()
});

export const insertWelcomeScreenSchema = createInsertSchema(welcomeScreen).pick({
  headingText: true,
  deliveryLabel: true,
  fallbackName: true,
  enabled: true
});

export const contentSections = pgTable("content_sections", {
  id: serial("id").primaryKey(),
  sectionKey: text("section_key").notNull().unique(),
  data: jsonb("data").notNull(),
  updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull()
});

export const contentEntries = pgTable("content_entries", {
  id: serial("id").primaryKey(),
  category: text("category").notNull(),
  order: integer("order").notNull().default(0),
  data: jsonb("data").notNull(),
  createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull()
});

export const insertContentSectionSchema = createInsertSchema(contentSections).pick({
  sectionKey: true,
  data: true
});

// Specific data schemas for different content entry categories
const scheduleEntryDataSchema = z.object({
  time: z.string().min(1, "Time is required"),
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required")
});

export const insertContentEntrySchema = createInsertSchema(contentEntries).pick({
  category: true,
  order: true,
  data: true
}).extend({
  order: z.number().int().min(0).default(0)
}).superRefine((data, ctx) => {
  // Validate data structure based on category
  if (data.category === 'schedule') {
    const result = scheduleEntryDataSchema.safeParse(data.data);
    if (!result.success) {
      result.error.issues.forEach(issue => {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Schedule entry ${issue.path.join('.')}: ${issue.message}`,
          path: ['data', ...issue.path]
        });
      });
    }
  }
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
export type InsertAppSetting = z.infer<typeof insertAppSettingSchema>;
export type AppSetting = typeof appSettings.$inferSelect;
export type InsertWelcomeScreen = z.infer<typeof insertWelcomeScreenSchema>;
export type WelcomeScreen = typeof welcomeScreen.$inferSelect;
export type InsertContentSection = z.infer<typeof insertContentSectionSchema>;
export type ContentSection = typeof contentSections.$inferSelect;
export type InsertContentEntry = z.infer<typeof insertContentEntrySchema>;
export type ContentEntry = typeof contentEntries.$inferSelect;
