import { users, type User, type InsertUser, rsvp, type Rsvp, type InsertRsvp, media, type Media, type InsertMedia, configImages, type ConfigImage, type InsertConfigImage, featureFlags, type FeatureFlag, type InsertFeatureFlag, appSettings, type AppSetting, type InsertAppSetting, welcomeScreen, type WelcomeScreen, type InsertWelcomeScreen, messages, type Message, type InsertMessage } from "@shared/schema";
import { eq, desc, sql } from "drizzle-orm";
import { getDb } from "./db";
import Database from "@replit/database";
import fs from "fs";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // RSVP methods
  createRsvp(rsvpData: InsertRsvp): Promise<Rsvp>;
  updateRsvp(id: number, rsvpData: InsertRsvp): Promise<Rsvp>;
  getRsvps(): Promise<Rsvp[]>;
  getRsvpByEmail(email: string): Promise<Rsvp | undefined>;
  getRsvpByName(name: string): Promise<Rsvp | undefined>;
  deleteRsvp(id: number): Promise<boolean>;
  
  // Media methods
  createMedia(mediaData: InsertMedia): Promise<Media>;
  getMediaById(id: number): Promise<Media | undefined>;
  getAllMedia(): Promise<Media[]>;
  getApprovedMedia(): Promise<Media[]>;
  updateMediaApproval(id: number, approved: boolean): Promise<Media | undefined>;
  
  // Configurable images methods
  createConfigImage(imageData: InsertConfigImage): Promise<ConfigImage>;
  updateConfigImage(imageKey: string, imageData: InsertConfigImage): Promise<ConfigImage>;
  deleteConfigImage(imageKey: string): Promise<boolean>;
  getConfigImage(imageKey: string): Promise<ConfigImage | undefined>;
  getConfigImagesByType(imageType: string): Promise<ConfigImage[]>;
  getAllConfigImages(): Promise<ConfigImage[]>;
  
  // Feature flag methods
  createFeatureFlag(featureFlagData: InsertFeatureFlag): Promise<FeatureFlag>;
  updateFeatureFlag(featureKey: string, enabled: boolean): Promise<FeatureFlag | undefined>;
  getFeatureFlag(featureKey: string): Promise<FeatureFlag | undefined>;
  getAllFeatureFlags(): Promise<FeatureFlag[]>;
  
  // App settings methods
  createAppSetting(settingData: InsertAppSetting): Promise<AppSetting>;
  updateAppSetting(settingKey: string, settingData: InsertAppSetting): Promise<AppSetting>;
  getAppSetting(settingKey: string): Promise<AppSetting | undefined>;
  getAllAppSettings(): Promise<AppSetting[]>;
  
  // Welcome screen methods
  getWelcomeScreen(): Promise<WelcomeScreen>;
  updateWelcomeScreen(data: InsertWelcomeScreen): Promise<WelcomeScreen>;
  
  // Message methods
  createMessage(messageData: InsertMessage): Promise<Message>;
  getMessageById(id: number): Promise<Message | undefined>;
  getAllMessages(): Promise<Message[]>;
  deleteMessage(id: number): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private rsvps: Map<number, Rsvp>;
  private medias: Map<number, Media>;
  private configImages: Map<string, ConfigImage>;
  private featureFlags: Map<string, FeatureFlag>;
  private appSettings: Map<string, AppSetting>;
  private welcomeScreenData: WelcomeScreen | null;
  private messagesData: Map<number, Message>;
  currentUserId: number;
  currentRsvpId: number;
  currentMediaId: number;
  currentConfigImageId: number;
  currentFeatureFlagId: number;
  currentAppSettingId: number;
  currentMessageId: number;

  constructor() {
    this.users = new Map();
    this.rsvps = new Map();
    this.medias = new Map();
    this.configImages = new Map();
    this.featureFlags = new Map();
    this.appSettings = new Map();
    this.welcomeScreenData = null;
    this.messagesData = new Map();
    this.currentUserId = 1;
    this.currentRsvpId = 1;
    this.currentMediaId = 1;
    this.currentConfigImageId = 1;
    this.currentFeatureFlagId = 1;
    this.currentAppSettingId = 1;
    this.currentMessageId = 1;

    // Initialize default images and feature flags
    this.initializeDefaultImages();
    this.initializeDefaultFeatureFlags();
    this.initializeDefaultAppSettings();
    this.initializeDefaultWelcomeScreen();
  }
  
  private initializeDefaultWelcomeScreen() {
    this.welcomeScreenData = {
      id: 1,
      headingText: "The Wedding of Andreas & Christine",
      deliveryLabel: "Kindly Delivered to",
      fallbackName: "Our Dearest Guest",
      enabled: true,
      updatedAt: new Date().toISOString()
    };
  }

  private initializeDefaultImages() {
    // Default banner image
    const bannerImage: ConfigImage = {
      id: this.currentConfigImageId++,
      imageKey: 'banner',
      imageUrl: 'https://images.unsplash.com/photo-1469371670807-013ccf25f16a?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1920&q=80',
      thumbnailUrl: null,
      imageType: 'banner',
      title: 'Main Banner',
      description: 'Hero section background image',
      isActive: true,
      updatedAt: new Date().toISOString()
    };
    this.configImages.set('banner', bannerImage);

    // Default gallery images
    const defaultGalleryImages = [
      "https://images.unsplash.com/photo-1522673607200-164d1b3ce475?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80",
      "https://images.unsplash.com/photo-1494774157365-9e04c6720e47?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80",
      "https://images.unsplash.com/photo-1469371670807-013ccf25f16a?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80",
      "https://images.unsplash.com/photo-1583939003579-730e3918a45a?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80",
      "https://images.unsplash.com/photo-1537633552985-df8429e8048b?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80",
      "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80",
      "https://images.unsplash.com/photo-1545232979-8bf68ee9b1af?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80",
      "https://images.unsplash.com/photo-1530268729831-4b0b9e170218?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80"
    ];

    defaultGalleryImages.forEach((url, index) => {
      const galleryImage: ConfigImage = {
        id: this.currentConfigImageId++,
        imageKey: `gallery_default_${index + 1}`,
        imageUrl: url,
        thumbnailUrl: null,
        imageType: 'gallery',
        title: `Gallery Image ${index + 1}`,
        description: `Default gallery image ${index + 1}`,
        isActive: true,
        updatedAt: new Date().toISOString()
      };
      this.configImages.set(`gallery_default_${index + 1}`, galleryImage);
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }
  
  async createRsvp(insertRsvp: InsertRsvp): Promise<Rsvp> {
    const id = this.currentRsvpId++;
    const rsvpEntry: Rsvp = { 
      ...insertRsvp, 
      id,
      guestCount: insertRsvp.guestCount ?? null
    };
    this.rsvps.set(id, rsvpEntry);
    return rsvpEntry;
  }
  
  async getRsvps(): Promise<Rsvp[]> {
    return Array.from(this.rsvps.values());
  }
  
  async updateRsvp(id: number, insertRsvp: InsertRsvp): Promise<Rsvp> {
    const rsvpEntry: Rsvp = { 
      ...insertRsvp, 
      id,
      guestCount: insertRsvp.guestCount ?? null
    };
    this.rsvps.set(id, rsvpEntry);
    return rsvpEntry;
  }
  
  async getRsvpByEmail(email: string): Promise<Rsvp | undefined> {
    return Array.from(this.rsvps.values()).find(
      (rsvp) => rsvp.email.toLowerCase() === email.toLowerCase(),
    );
  }
  
  async getRsvpByName(name: string): Promise<Rsvp | undefined> {
    return Array.from(this.rsvps.values()).find(
      (rsvp) => rsvp.name.toLowerCase() === name.toLowerCase(),
    );
  }
  
  async deleteRsvp(id: number): Promise<boolean> {
    return this.rsvps.delete(id);
  }
  
  async createMedia(insertMedia: InsertMedia): Promise<Media> {
    const id = this.currentMediaId++;
    const now = new Date();
    const mediaEntry: Media = {
      ...insertMedia,
      id,
      mediaType: insertMedia.mediaType || 'image',
      caption: insertMedia.caption ?? null,
      approved: false,
      createdAt: now.toISOString()
    };
    this.medias.set(id, mediaEntry);
    return mediaEntry;
  }
  
  async getMediaById(id: number): Promise<Media | undefined> {
    return this.medias.get(id);
  }
  
  async getAllMedia(): Promise<Media[]> {
    // Return all media sorted by creation date (newest first)
    return Array.from(this.medias.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
  
  async getApprovedMedia(): Promise<Media[]> {
    // Return only approved media sorted by creation date (newest first)
    return Array.from(this.medias.values())
      .filter(media => media.approved)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
  
  async updateMediaApproval(id: number, approved: boolean): Promise<Media | undefined> {
    const media = this.medias.get(id);
    if (!media) return undefined;
    
    const updatedMedia: Media = { ...media, approved };
    this.medias.set(id, updatedMedia);
    return updatedMedia;
  }

  // Configurable images methods
  async createConfigImage(insertConfigImage: InsertConfigImage): Promise<ConfigImage> {
    const id = this.currentConfigImageId++;
    const now = new Date();
    const configImage: ConfigImage = {
      ...insertConfigImage,
      id,
      thumbnailUrl: insertConfigImage.thumbnailUrl ?? null,
      title: insertConfigImage.title ?? null,
      description: insertConfigImage.description ?? null,
      isActive: insertConfigImage.isActive ?? true,
      updatedAt: now.toISOString()
    };
    this.configImages.set(configImage.imageKey, configImage);
    return configImage;
  }

  async updateConfigImage(imageKey: string, insertConfigImage: InsertConfigImage): Promise<ConfigImage> {
    const existing = this.configImages.get(imageKey);
    const id = existing?.id ?? this.currentConfigImageId++;
    const now = new Date();
    const configImage: ConfigImage = {
      ...insertConfigImage,
      id,
      imageKey,
      thumbnailUrl: insertConfigImage.thumbnailUrl ?? null,
      title: insertConfigImage.title ?? null,
      description: insertConfigImage.description ?? null,
      isActive: insertConfigImage.isActive ?? true,
      updatedAt: now.toISOString()
    };
    this.configImages.set(imageKey, configImage);
    return configImage;
  }

  async getConfigImage(imageKey: string): Promise<ConfigImage | undefined> {
    return this.configImages.get(imageKey);
  }

  async getConfigImagesByType(imageType: string): Promise<ConfigImage[]> {
    return Array.from(this.configImages.values())
      .filter(image => image.imageType === imageType && image.isActive)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  async getAllConfigImages(): Promise<ConfigImage[]> {
    return Array.from(this.configImages.values())
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  async deleteConfigImage(imageKey: string): Promise<boolean> {
    return this.configImages.delete(imageKey);
  }

  private initializeDefaultFeatureFlags() {
    const defaultFeatures = [
      {
        featureKey: 'rsvp',
        featureName: 'RSVP Form',
        description: 'Allow guests to submit their attendance confirmation',
        enabled: true
      },
      {
        featureKey: 'messages',
        featureName: 'Message Board',
        description: 'Allow guests to leave congratulatory messages',
        enabled: true
      },
      {
        featureKey: 'gallery',
        featureName: 'Photo Gallery',
        description: 'Display wedding memories and allow photo uploads',
        enabled: true
      },
      {
        featureKey: 'music',
        featureName: 'Background Music',
        description: 'Play background music on the invitation page',
        enabled: true
      },
      {
        featureKey: 'countdown',
        featureName: 'Wedding Countdown',
        description: 'Show countdown timer to wedding date',
        enabled: true
      },
      {
        featureKey: 'egift',
        featureName: 'E-Gift / Bank Transfer',
        description: 'Allow guests to send monetary gifts via bank transfer',
        enabled: true
      }
    ];

    defaultFeatures.forEach(feature => {
      const featureFlag: FeatureFlag = {
        id: this.currentFeatureFlagId++,
        ...feature,
        updatedAt: new Date().toISOString()
      };
      this.featureFlags.set(feature.featureKey, featureFlag);
    });
  }

  // Feature flag methods
  async createFeatureFlag(insertFeatureFlag: InsertFeatureFlag): Promise<FeatureFlag> {
    const id = this.currentFeatureFlagId++;
    const now = new Date();
    const featureFlag: FeatureFlag = {
      ...insertFeatureFlag,
      id,
      enabled: insertFeatureFlag.enabled ?? true,
      updatedAt: now.toISOString()
    };
    this.featureFlags.set(featureFlag.featureKey, featureFlag);
    return featureFlag;
  }

  async updateFeatureFlag(featureKey: string, enabled: boolean): Promise<FeatureFlag | undefined> {
    const existing = this.featureFlags.get(featureKey);
    if (!existing) return undefined;

    const updatedFeatureFlag: FeatureFlag = {
      ...existing,
      enabled,
      updatedAt: new Date().toISOString()
    };
    this.featureFlags.set(featureKey, updatedFeatureFlag);
    return updatedFeatureFlag;
  }

  async getFeatureFlag(featureKey: string): Promise<FeatureFlag | undefined> {
    return this.featureFlags.get(featureKey);
  }

  async getAllFeatureFlags(): Promise<FeatureFlag[]> {
    return Array.from(this.featureFlags.values())
      .sort((a, b) => a.featureName.localeCompare(b.featureName));
  }

  private initializeDefaultAppSettings() {
    const now = new Date().toISOString();
    const defaultSettings = [
      {
        settingKey: 'background_music_url',
        settingValue: '/music/wedding-piano.mp3',
        settingType: 'audio',
        description: 'Background music file URL'
      },
      {
        settingKey: 'egift_groom_name',
        settingValue: 'Andreas',
        settingType: 'text',
        description: 'Groom account holder name for e-gift'
      },
      {
        settingKey: 'egift_groom_bank',
        settingValue: 'Bank BCA',
        settingType: 'text',
        description: 'Groom bank name for e-gift'
      },
      {
        settingKey: 'egift_groom_account',
        settingValue: '1234567890',
        settingType: 'text',
        description: 'Groom account number for e-gift'
      },
      {
        settingKey: 'egift_bride_name',
        settingValue: 'Christine',
        settingType: 'text',
        description: 'Bride account holder name for e-gift'
      },
      {
        settingKey: 'egift_bride_bank',
        settingValue: 'Bank BCA',
        settingType: 'text',
        description: 'Bride bank name for e-gift'
      },
      {
        settingKey: 'egift_bride_account',
        settingValue: '0987654321',
        settingType: 'text',
        description: 'Bride account number for e-gift'
      }
    ];
    
    defaultSettings.forEach(setting => {
      const appSetting: AppSetting = {
        id: this.currentAppSettingId++,
        ...setting,
        updatedAt: now
      };
      this.appSettings.set(setting.settingKey, appSetting);
    });
  }

  async createAppSetting(insertAppSetting: InsertAppSetting): Promise<AppSetting> {
    const id = this.currentAppSettingId++;
    const now = new Date();
    const appSetting: AppSetting = {
      ...insertAppSetting,
      id,
      description: insertAppSetting.description ?? null,
      updatedAt: now.toISOString()
    };
    this.appSettings.set(appSetting.settingKey, appSetting);
    return appSetting;
  }

  async updateAppSetting(settingKey: string, insertAppSetting: InsertAppSetting): Promise<AppSetting> {
    const existing = this.appSettings.get(settingKey);
    const id = existing?.id ?? this.currentAppSettingId++;
    const now = new Date();
    const appSetting: AppSetting = {
      ...insertAppSetting,
      id,
      settingKey,
      description: insertAppSetting.description ?? null,
      updatedAt: now.toISOString()
    };
    this.appSettings.set(settingKey, appSetting);
    return appSetting;
  }

  async getAppSetting(settingKey: string): Promise<AppSetting | undefined> {
    return this.appSettings.get(settingKey);
  }

  async getAllAppSettings(): Promise<AppSetting[]> {
    return Array.from(this.appSettings.values())
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }
  
  async getWelcomeScreen(): Promise<WelcomeScreen> {
    if (!this.welcomeScreenData) {
      this.initializeDefaultWelcomeScreen();
    }
    return this.welcomeScreenData!;
  }
  
  async updateWelcomeScreen(data: InsertWelcomeScreen): Promise<WelcomeScreen> {
    const now = new Date();
    const existing = await this.getWelcomeScreen();
    this.welcomeScreenData = {
      id: 1,
      headingText: data.headingText ?? existing.headingText,
      deliveryLabel: data.deliveryLabel ?? existing.deliveryLabel,
      fallbackName: data.fallbackName ?? existing.fallbackName,
      enabled: data.enabled ?? existing.enabled,
      updatedAt: now.toISOString()
    };
    return this.welcomeScreenData;
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const id = this.currentMessageId++;
    const now = new Date();
    const message: Message = {
      id,
      ...insertMessage,
      createdAt: now.toISOString()
    };
    this.messagesData.set(id, message);
    return message;
  }

  async getMessageById(id: number): Promise<Message | undefined> {
    return this.messagesData.get(id);
  }

  async getAllMessages(): Promise<Message[]> {
    return Array.from(this.messagesData.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async deleteMessage(id: number): Promise<boolean> {
    if (this.messagesData.has(id)) {
      this.messagesData.delete(id);
      return true;
    }
    return false;
  }
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await getDb().select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await getDb().select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await getDb()
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async createRsvp(insertRsvp: InsertRsvp): Promise<Rsvp> {
    const [rsvpEntry] = await getDb()
      .insert(rsvp)
      .values(insertRsvp)
      .returning();
    return rsvpEntry;
  }

  async updateRsvp(id: number, insertRsvp: InsertRsvp): Promise<Rsvp> {
    const [rsvpEntry] = await getDb()
      .update(rsvp)
      .set(insertRsvp)
      .where(eq(rsvp.id, id))
      .returning();
    return rsvpEntry;
  }

  async getRsvps(): Promise<Rsvp[]> {
    return getDb().select().from(rsvp);
  }

  async getRsvpByEmail(email: string): Promise<Rsvp | undefined> {
    const normalizedEmail = email.toLowerCase();
    const [rsvpEntry] = await getDb()
      .select()
      .from(rsvp)
      .where(sql`LOWER(${rsvp.email}) = ${normalizedEmail}`);
    return rsvpEntry || undefined;
  }

  async getRsvpByName(name: string): Promise<Rsvp | undefined> {
    const normalizedName = name.toLowerCase();
    const [rsvpEntry] = await getDb()
      .select()
      .from(rsvp)
      .where(sql`LOWER(${rsvp.name}) = ${normalizedName}`);
    return rsvpEntry || undefined;
  }

  async deleteRsvp(id: number): Promise<boolean> {
    const result = await getDb()
      .delete(rsvp)
      .where(eq(rsvp.id, id))
      .returning();
    return result.length > 0;
  }

  async createMedia(insertMedia: InsertMedia): Promise<Media> {
    const [mediaEntry] = await getDb()
      .insert(media)
      .values(insertMedia)
      .returning();
    return mediaEntry;
  }

  async getMediaById(id: number): Promise<Media | undefined> {
    const [mediaEntry] = await getDb()
      .select()
      .from(media)
      .where(eq(media.id, id));
    return mediaEntry || undefined;
  }

  async getAllMedia(): Promise<Media[]> {
    return getDb()
      .select()
      .from(media)
      .orderBy(desc(media.createdAt));
  }

  async getApprovedMedia(): Promise<Media[]> {
    return getDb()
      .select()
      .from(media)
      .where(eq(media.approved, true))
      .orderBy(desc(media.createdAt));
  }

  async updateMediaApproval(id: number, approved: boolean): Promise<Media | undefined> {
    const [mediaEntry] = await getDb()
      .update(media)
      .set({ approved })
      .where(eq(media.id, id))
      .returning();
    return mediaEntry || undefined;
  }

  // Configurable images methods
  async createConfigImage(insertConfigImage: InsertConfigImage): Promise<ConfigImage> {
    const [configImage] = await getDb()
      .insert(configImages)
      .values(insertConfigImage)
      .returning();
    return configImage;
  }

  async updateConfigImage(imageKey: string, insertConfigImage: InsertConfigImage): Promise<ConfigImage> {
    const [configImage] = await getDb()
      .insert(configImages)
      .values({ ...insertConfigImage, imageKey })
      .onConflictDoUpdate({
        target: configImages.imageKey,
        set: {
          imageUrl: insertConfigImage.imageUrl,
          thumbnailUrl: insertConfigImage.thumbnailUrl,
          imageType: insertConfigImage.imageType,
          title: insertConfigImage.title,
          description: insertConfigImage.description,
          isActive: insertConfigImage.isActive,
          updatedAt: sql`now()`
        }
      })
      .returning();
    return configImage;
  }

  async getConfigImage(imageKey: string): Promise<ConfigImage | undefined> {
    const [configImage] = await getDb()
      .select()
      .from(configImages)
      .where(eq(configImages.imageKey, imageKey));
    return configImage || undefined;
  }

  async getConfigImagesByType(imageType: string): Promise<ConfigImage[]> {
    return getDb()
      .select()
      .from(configImages)
      .where(sql`${configImages.imageType} = ${imageType} AND ${configImages.isActive} = true`)
      .orderBy(desc(configImages.updatedAt));
  }

  async getAllConfigImages(): Promise<ConfigImage[]> {
    return getDb()
      .select()
      .from(configImages)
      .orderBy(desc(configImages.updatedAt));
  }

  async deleteConfigImage(imageKey: string): Promise<boolean> {
    const result = await getDb()
      .delete(configImages)
      .where(eq(configImages.imageKey, imageKey));
    return (result.rowCount || 0) > 0;
  }

  // Feature flag methods
  async createFeatureFlag(insertFeatureFlag: InsertFeatureFlag): Promise<FeatureFlag> {
    const [featureFlag] = await getDb()
      .insert(featureFlags)
      .values(insertFeatureFlag)
      .returning();
    return featureFlag;
  }

  async updateFeatureFlag(featureKey: string, enabled: boolean): Promise<FeatureFlag | undefined> {
    const [featureFlag] = await getDb()
      .update(featureFlags)
      .set({ enabled, updatedAt: sql`now()` })
      .where(eq(featureFlags.featureKey, featureKey))
      .returning();
    return featureFlag || undefined;
  }

  async getFeatureFlag(featureKey: string): Promise<FeatureFlag | undefined> {
    const [featureFlag] = await getDb()
      .select()
      .from(featureFlags)
      .where(eq(featureFlags.featureKey, featureKey));
    return featureFlag || undefined;
  }

  async getAllFeatureFlags(): Promise<FeatureFlag[]> {
    return getDb()
      .select()
      .from(featureFlags)
      .orderBy(featureFlags.featureName);
  }

  async createAppSetting(insertAppSetting: InsertAppSetting): Promise<AppSetting> {
    const [appSetting] = await getDb()
      .insert(appSettings)
      .values(insertAppSetting)
      .returning();
    return appSetting;
  }

  async updateAppSetting(settingKey: string, insertAppSetting: InsertAppSetting): Promise<AppSetting> {
    const [appSetting] = await getDb()
      .insert(appSettings)
      .values({ ...insertAppSetting, settingKey })
      .onConflictDoUpdate({
        target: appSettings.settingKey,
        set: {
          settingValue: insertAppSetting.settingValue,
          settingType: insertAppSetting.settingType,
          description: insertAppSetting.description,
          updatedAt: sql`now()`
        }
      })
      .returning();
    return appSetting;
  }

  async getAppSetting(settingKey: string): Promise<AppSetting | undefined> {
    const [appSetting] = await getDb()
      .select()
      .from(appSettings)
      .where(eq(appSettings.settingKey, settingKey));
    return appSetting || undefined;
  }

  async getAllAppSettings(): Promise<AppSetting[]> {
    return getDb()
      .select()
      .from(appSettings)
      .orderBy(desc(appSettings.updatedAt));
  }
  
  async getWelcomeScreen(): Promise<WelcomeScreen> {
    const [welcome] = await getDb()
      .select()
      .from(welcomeScreen)
      .limit(1);
    
    if (!welcome) {
      const [newWelcome] = await getDb()
        .insert(welcomeScreen)
        .values({
          headingText: "The Wedding of Andreas & Christine",
          deliveryLabel: "Kindly Delivered to",
          fallbackName: "Our Dearest Guest",
          enabled: true
        })
        .returning();
      return newWelcome;
    }
    
    return welcome;
  }
  
  async updateWelcomeScreen(data: InsertWelcomeScreen): Promise<WelcomeScreen> {
    const existing = await this.getWelcomeScreen();
    
    const [updated] = await getDb()
      .update(welcomeScreen)
      .set({
        ...data,
        updatedAt: sql`now()`
      })
      .where(eq(welcomeScreen.id, existing.id))
      .returning();
    
    return updated;
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const [message] = await getDb()
      .insert(messages)
      .values(insertMessage)
      .returning();
    return message;
  }

  async getMessageById(id: number): Promise<Message | undefined> {
    const [message] = await getDb()
      .select()
      .from(messages)
      .where(eq(messages.id, id));
    return message || undefined;
  }

  async getAllMessages(): Promise<Message[]> {
    return getDb()
      .select()
      .from(messages)
      .orderBy(desc(messages.createdAt));
  }

  async deleteMessage(id: number): Promise<boolean> {
    const result = await getDb()
      .delete(messages)
      .where(eq(messages.id, id))
      .returning();
    return result.length > 0;
  }
}

export class KeyValueStorage implements IStorage {
  private kv: Database | null = null;
  private currentUserId: number = 1;
  private currentRsvpId: number = 1;
  private currentMediaId: number = 1;
  private currentConfigImageId: number = 1;
  private currentFeatureFlagId: number = 1;
  private currentAppSettingId: number = 1;

  constructor() {
    // Only initialize Replit Database if REPLIT_DB_URL is available (from file or env var)
    const replitDbUrl = getReplitDatabaseUrl();
    if (replitDbUrl) {
      this.kv = new Database(replitDbUrl);
      this.initializeDefaults();
    } else {
      console.warn('KeyValueStorage: REPLIT_DB_URL not found, storage will not be available');
    }
  }

  private ensureKvAvailable(): Database {
    if (!this.kv) {
      throw new Error('KeyValueStorage: Replit Database not available. REPLIT_DB_URL environment variable is required.');
    }
    return this.kv;
  }

  private async initializeDefaults() {
    // Initialize default feature flags - add any missing ones
    await this.ensureDefaultFeatureFlags();

    // Initialize default images if they don't exist
    const existingImages = await this.getAllConfigImages();
    if (existingImages.length === 0) {
      await this.initializeDefaultImages();
    }

    // Initialize default app settings if they don't exist
    const existingSettings = await this.getAllAppSettings();
    if (existingSettings.length === 0) {
      await this.initializeDefaultAppSettings();
    }
  }

  private async ensureDefaultFeatureFlags() {
    const kv = this.ensureKvAvailable();
    const defaultFeatures = [
      {
        featureKey: 'rsvp',
        featureName: 'RSVP Form',
        description: 'Allow guests to submit their attendance confirmation',
        enabled: true
      },
      {
        featureKey: 'messages',
        featureName: 'Message Board',
        description: 'Allow guests to leave congratulatory messages',
        enabled: false
      },
      {
        featureKey: 'gallery',
        featureName: 'Photo Gallery',
        description: 'Display wedding memories and allow photo uploads',
        enabled: true
      },
      {
        featureKey: 'music',
        featureName: 'Background Music',
        description: 'Play background music on the invitation page',
        enabled: false
      },
      {
        featureKey: 'countdown',
        featureName: 'Wedding Countdown',
        description: 'Show countdown timer to wedding date',
        enabled: false
      },
      {
        featureKey: 'egift',
        featureName: 'E-Gift / Bank Transfer',
        description: 'Allow guests to send monetary gifts via bank transfer',
        enabled: true
      }
    ];

    for (const feature of defaultFeatures) {
      const existingResult = await kv.get(`feature_flag:${feature.featureKey}`);
      if (!existingResult.ok || !existingResult.value) {
        const featureFlag: FeatureFlag = {
          id: this.currentFeatureFlagId++,
          ...feature,
          updatedAt: new Date().toISOString()
        };
        await kv.set(`feature_flag:${feature.featureKey}`, featureFlag);
        console.log(`Added missing feature flag: ${feature.featureKey}`);
      }
    }
  }

  private async initializeDefaultImages() {
    const kv = this.ensureKvAvailable();
    // Default banner image
    const bannerImage: ConfigImage = {
      id: this.currentConfigImageId++,
      imageKey: 'banner',
      imageUrl: 'https://images.unsplash.com/photo-1469371670807-013ccf25f16a?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1920&q=80',
      thumbnailUrl: null,
      imageType: 'banner',
      title: 'Main Banner',
      description: 'Hero section background image',
      isActive: true,
      updatedAt: new Date().toISOString()
    };
    await kv.set(`config_image:banner`, bannerImage);

    // Default gallery images
    const defaultGalleryImages = [
      "https://images.unsplash.com/photo-1522673607200-164d1b3ce475?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80",
      "https://images.unsplash.com/photo-1494774157365-9e04c6720e47?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80"
    ];

    for (let i = 0; i < defaultGalleryImages.length; i++) {
      const galleryImage: ConfigImage = {
        id: this.currentConfigImageId++,
        imageKey: `gallery_default_${i + 1}`,
        imageUrl: defaultGalleryImages[i],
        thumbnailUrl: null,
        imageType: 'gallery',
        title: `Gallery Image ${i + 1}`,
        description: `Default gallery image ${i + 1}`,
        isActive: true,
        updatedAt: new Date().toISOString()
      };
      await kv.set(`config_image:gallery_default_${i + 1}`, galleryImage);
    }
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const kv = this.ensureKvAvailable();
    const result = await kv.get(`user:${id}`);
    return result.ok ? result.value : undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    // Note: This is less efficient with KV store - would need to iterate through all users
    // For production, consider maintaining a username index
    const kv = this.ensureKvAvailable();
    const keysResult = await kv.list("user:");
    if (!keysResult.ok) return undefined;
    
    for (const key of keysResult.value) {
      const userResult = await kv.get(key);
      if (userResult.ok && userResult.value && userResult.value.username === username) {
        return userResult.value;
      }
    }
    return undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const kv = this.ensureKvAvailable();
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id };
    await kv.set(`user:${id}`, user);
    return user;
  }

  // RSVP methods
  async createRsvp(insertRsvp: InsertRsvp): Promise<Rsvp> {
    const kv = this.ensureKvAvailable();
    const id = this.currentRsvpId++;
    const rsvpEntry: Rsvp = { 
      ...insertRsvp, 
      id,
      guestCount: insertRsvp.guestCount ?? null
    };
    await kv.set(`rsvp:${id}`, rsvpEntry);
    return rsvpEntry;
  }

  async updateRsvp(id: number, insertRsvp: InsertRsvp): Promise<Rsvp> {
    const kv = this.ensureKvAvailable();
    const rsvpEntry: Rsvp = { 
      ...insertRsvp, 
      id,
      guestCount: insertRsvp.guestCount ?? null
    };
    await kv.set(`rsvp:${id}`, rsvpEntry);
    return rsvpEntry;
  }

  async getRsvps(): Promise<Rsvp[]> {
    const kv = this.ensureKvAvailable();
    const keysResult = await kv.list("rsvp:");
    if (!keysResult.ok) return [];
    
    const rsvps = [];
    for (const key of keysResult.value) {
      const rsvpResult = await kv.get(key);
      if (rsvpResult.ok && rsvpResult.value) rsvps.push(rsvpResult.value);
    }
    return rsvps;
  }

  async getRsvpByEmail(email: string): Promise<Rsvp | undefined> {
    const kv = this.ensureKvAvailable();
    const keysResult = await kv.list("rsvp:");
    if (!keysResult.ok) return undefined;
    
    for (const key of keysResult.value) {
      const rsvpResult = await kv.get(key);
      if (rsvpResult.ok && rsvpResult.value && rsvpResult.value.email.toLowerCase() === email.toLowerCase()) {
        return rsvpResult.value;
      }
    }
    return undefined;
  }

  async getRsvpByName(name: string): Promise<Rsvp | undefined> {
    const kv = this.ensureKvAvailable();
    const keysResult = await kv.list("rsvp:");
    if (!keysResult.ok) return undefined;
    
    for (const key of keysResult.value) {
      const rsvpResult = await kv.get(key);
      if (rsvpResult.ok && rsvpResult.value && rsvpResult.value.name.toLowerCase() === name.toLowerCase()) {
        return rsvpResult.value;
      }
    }
    return undefined;
  }

  async deleteRsvp(id: number): Promise<boolean> {
    const kv = this.ensureKvAvailable();
    const deleteResult = await kv.delete(`rsvp:${id}`);
    return deleteResult.ok;
  }

  // Media methods
  async createMedia(insertMedia: InsertMedia): Promise<Media> {
    const kv = this.ensureKvAvailable();
    const id = this.currentMediaId++;
    const now = new Date();
    const mediaEntry: Media = {
      ...insertMedia,
      id,
      mediaType: insertMedia.mediaType || 'image',
      caption: insertMedia.caption ?? null,
      approved: false,
      createdAt: now.toISOString()
    };
    await kv.set(`media:${id}`, mediaEntry);
    return mediaEntry;
  }

  async getMediaById(id: number): Promise<Media | undefined> {
    const kv = this.ensureKvAvailable();
    const result = await kv.get(`media:${id}`);
    return result.ok ? result.value : undefined;
  }

  async getAllMedia(): Promise<Media[]> {
    const kv = this.ensureKvAvailable();
    const keysResult = await kv.list("media:");
    if (!keysResult.ok) return [];
    
    const medias = [];
    for (const key of keysResult.value) {
      const mediaResult = await kv.get(key);
      if (mediaResult.ok && mediaResult.value) medias.push(mediaResult.value);
    }
    return medias.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getApprovedMedia(): Promise<Media[]> {
    const allMedia = await this.getAllMedia();
    return allMedia.filter(media => media.approved);
  }

  async updateMediaApproval(id: number, approved: boolean): Promise<Media | undefined> {
    const kv = this.ensureKvAvailable();
    const mediaResult = await kv.get(`media:${id}`);
    if (!mediaResult.ok || !mediaResult.value) return undefined;
    
    const updatedMedia: Media = { ...mediaResult.value, approved };
    await kv.set(`media:${id}`, updatedMedia);
    return updatedMedia;
  }

  // Config image methods
  async createConfigImage(insertConfigImage: InsertConfigImage): Promise<ConfigImage> {
    const kv = this.ensureKvAvailable();
    const id = this.currentConfigImageId++;
    const now = new Date();
    const configImage: ConfigImage = {
      ...insertConfigImage,
      id,
      thumbnailUrl: insertConfigImage.thumbnailUrl ?? null,
      title: insertConfigImage.title ?? null,
      description: insertConfigImage.description ?? null,
      isActive: insertConfigImage.isActive ?? true,
      updatedAt: now.toISOString()
    };
    await kv.set(`config_image:${configImage.imageKey}`, configImage);
    return configImage;
  }

  async updateConfigImage(imageKey: string, insertConfigImage: InsertConfigImage): Promise<ConfigImage> {
    const kv = this.ensureKvAvailable();
    const existingResult = await kv.get(`config_image:${imageKey}`);
    const id = (existingResult.ok && existingResult.value) ? existingResult.value.id : this.currentConfigImageId++;
    const now = new Date();
    const configImage: ConfigImage = {
      ...insertConfigImage,
      id,
      imageKey,
      thumbnailUrl: insertConfigImage.thumbnailUrl ?? null,
      title: insertConfigImage.title ?? null,
      description: insertConfigImage.description ?? null,
      isActive: insertConfigImage.isActive ?? true,
      updatedAt: now.toISOString()
    };
    await kv.set(`config_image:${imageKey}`, configImage);
    return configImage;
  }

  async getConfigImage(imageKey: string): Promise<ConfigImage | undefined> {
    const kv = this.ensureKvAvailable();
    const result = await kv.get(`config_image:${imageKey}`);
    return result.ok ? result.value : undefined;
  }

  async getConfigImagesByType(imageType: string): Promise<ConfigImage[]> {
    const kv = this.ensureKvAvailable();
    const keysResult = await kv.list("config_image:");
    if (!keysResult.ok) return [];
    
    // Fetch all images in parallel to avoid N+1 query problem
    const imagePromises = keysResult.value.map(key => kv.get(key));
    const imageResults = await Promise.all(imagePromises);
    
    const images = imageResults
      .filter(result => result.ok && result.value && result.value.imageType === imageType && result.value.isActive)
      .map(result => result.value as ConfigImage);
    
    return images.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  async getAllConfigImages(): Promise<ConfigImage[]> {
    const kv = this.ensureKvAvailable();
    const keysResult = await kv.list("config_image:");
    if (!keysResult.ok) return [];
    
    // Fetch all images in parallel to avoid N+1 query problem
    const imagePromises = keysResult.value.map(key => kv.get(key));
    const imageResults = await Promise.all(imagePromises);
    
    const images = imageResults
      .filter(result => result.ok && result.value)
      .map(result => result.value as ConfigImage);
    
    return images.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  async deleteConfigImage(imageKey: string): Promise<boolean> {
    const kv = this.ensureKvAvailable();
    await kv.delete(`config_image:${imageKey}`);
    return true;
  }

  // Feature flag methods
  async createFeatureFlag(insertFeatureFlag: InsertFeatureFlag): Promise<FeatureFlag> {
    const kv = this.ensureKvAvailable();
    const id = this.currentFeatureFlagId++;
    const now = new Date();
    const featureFlag: FeatureFlag = {
      ...insertFeatureFlag,
      id,
      enabled: insertFeatureFlag.enabled ?? true,
      updatedAt: now.toISOString()
    };
    await kv.set(`feature_flag:${featureFlag.featureKey}`, featureFlag);
    return featureFlag;
  }

  async updateFeatureFlag(featureKey: string, enabled: boolean): Promise<FeatureFlag | undefined> {
    const kv = this.ensureKvAvailable();
    const existingResult = await kv.get(`feature_flag:${featureKey}`);
    if (!existingResult.ok || !existingResult.value) return undefined;

    const updatedFeatureFlag: FeatureFlag = {
      ...existingResult.value,
      enabled,
      updatedAt: new Date().toISOString()
    };
    await kv.set(`feature_flag:${featureKey}`, updatedFeatureFlag);
    return updatedFeatureFlag;
  }

  async getFeatureFlag(featureKey: string): Promise<FeatureFlag | undefined> {
    const kv = this.ensureKvAvailable();
    const result = await kv.get(`feature_flag:${featureKey}`);
    return result.ok ? result.value : undefined;
  }

  async getAllFeatureFlags(): Promise<FeatureFlag[]> {
    const kv = this.ensureKvAvailable();
    const keysResult = await kv.list("feature_flag:");
    if (!keysResult.ok) return [];
    
    // Fetch all flags in parallel to avoid N+1 query problem
    const flagPromises = keysResult.value.map(key => kv.get(key));
    const flagResults = await Promise.all(flagPromises);
    
    const flags = flagResults
      .filter(result => result.ok && result.value)
      .map(result => result.value as FeatureFlag);
    
    return flags.sort((a, b) => a.featureName.localeCompare(b.featureName));
  }

  private async initializeDefaultAppSettings() {
    const kv = this.ensureKvAvailable();
    const now = new Date().toISOString();
    const defaultSettings = [
      {
        settingKey: 'background_music_url',
        settingValue: '/music/wedding-piano.mp3',
        settingType: 'audio',
        description: 'Background music file URL'
      },
      {
        settingKey: 'egift_groom_name',
        settingValue: 'Andreas',
        settingType: 'text',
        description: 'Groom account holder name for e-gift'
      },
      {
        settingKey: 'egift_groom_bank',
        settingValue: 'Bank BCA',
        settingType: 'text',
        description: 'Groom bank name for e-gift'
      },
      {
        settingKey: 'egift_groom_account',
        settingValue: '1234567890',
        settingType: 'text',
        description: 'Groom account number for e-gift'
      },
      {
        settingKey: 'egift_bride_name',
        settingValue: 'Christine',
        settingType: 'text',
        description: 'Bride account holder name for e-gift'
      },
      {
        settingKey: 'egift_bride_bank',
        settingValue: 'Bank BCA',
        settingType: 'text',
        description: 'Bride bank name for e-gift'
      },
      {
        settingKey: 'egift_bride_account',
        settingValue: '0987654321',
        settingType: 'text',
        description: 'Bride account number for e-gift'
      }
    ];
    
    for (const setting of defaultSettings) {
      const appSetting: AppSetting = {
        id: this.currentAppSettingId++,
        ...setting,
        updatedAt: now
      };
      await kv.set(`app_setting:${setting.settingKey}`, appSetting);
    }
  }

  async createAppSetting(insertAppSetting: InsertAppSetting): Promise<AppSetting> {
    const kv = this.ensureKvAvailable();
    const id = this.currentAppSettingId++;
    const now = new Date();
    const appSetting: AppSetting = {
      ...insertAppSetting,
      id,
      description: insertAppSetting.description ?? null,
      updatedAt: now.toISOString()
    };
    await kv.set(`app_setting:${appSetting.settingKey}`, appSetting);
    return appSetting;
  }

  async updateAppSetting(settingKey: string, insertAppSetting: InsertAppSetting): Promise<AppSetting> {
    const kv = this.ensureKvAvailable();
    const existingResult = await kv.get(`app_setting:${settingKey}`);
    const id = (existingResult.ok && existingResult.value) ? existingResult.value.id : this.currentAppSettingId++;
    const now = new Date();
    const appSetting: AppSetting = {
      ...insertAppSetting,
      id,
      settingKey,
      description: insertAppSetting.description ?? null,
      updatedAt: now.toISOString()
    };
    await kv.set(`app_setting:${settingKey}`, appSetting);
    return appSetting;
  }

  async getAppSetting(settingKey: string): Promise<AppSetting | undefined> {
    try {
      const kv = this.ensureKvAvailable();
      const result = await kv.get(`app_setting:${settingKey}`);
      return result.ok ? result.value : undefined;
    } catch (error) {
      console.error(`Error getting app setting ${settingKey}:`, error);
      return undefined;
    }
  }

  async getAllAppSettings(): Promise<AppSetting[]> {
    const kv = this.ensureKvAvailable();
    const keysResult = await kv.list("app_setting:");
    if (!keysResult.ok) return [];
    
    // Fetch all settings in parallel to avoid N+1 query problem
    const settingPromises = keysResult.value.map(key => kv.get(key));
    const settingResults = await Promise.all(settingPromises);
    
    const settings = settingResults
      .filter(result => result.ok && result.value)
      .map(result => result.value as AppSetting);
    
    return settings.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }
  
  async getWelcomeScreen(): Promise<WelcomeScreen> {
    try {
      const kv = this.ensureKvAvailable();
      const result = await kv.get('welcome_screen');
      
      if (result.ok && result.value) {
        return result.value;
      }
      
      const defaultWelcome: WelcomeScreen = {
        id: 1,
        headingText: "The Wedding of Andreas & Christine",
        deliveryLabel: "Kindly Delivered to",
        fallbackName: "Our Dearest Guest",
        enabled: true,
        updatedAt: new Date().toISOString()
      };
      
      await kv.set('welcome_screen', defaultWelcome);
      return defaultWelcome;
    } catch (error) {
      console.error('Error getting welcome screen:', error);
      throw error;
    }
  }
  
  async updateWelcomeScreen(data: InsertWelcomeScreen): Promise<WelcomeScreen> {
    const kv = this.ensureKvAvailable();
    const existing = await this.getWelcomeScreen();
    const now = new Date();
    
    const updated: WelcomeScreen = {
      id: existing.id,
      headingText: data.headingText ?? existing.headingText,
      deliveryLabel: data.deliveryLabel ?? existing.deliveryLabel,
      fallbackName: data.fallbackName ?? existing.fallbackName,
      enabled: data.enabled ?? existing.enabled,
      updatedAt: now.toISOString()
    };
    
    await kv.set('welcome_screen', updated);
    return updated;
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const kv = this.ensureKvAvailable();
    const messagesData = await this.getAllMessagesData();
    
    // Calculate next ID from existing messages to ensure uniqueness across restarts
    const existingIds = Object.keys(messagesData).map(k => parseInt(k, 10));
    const nextId = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;
    
    const now = new Date();
    const message: Message = {
      id: nextId,
      ...insertMessage,
      createdAt: now.toISOString()
    };
    
    messagesData[nextId] = message;
    await kv.set('messages', messagesData);
    
    return message;
  }

  async getMessageById(id: number): Promise<Message | undefined> {
    const messagesData = await this.getAllMessagesData();
    return messagesData[id];
  }

  async getAllMessages(): Promise<Message[]> {
    const messagesData = await this.getAllMessagesData();
    return Object.values(messagesData)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  private async getAllMessagesData(): Promise<Record<number, Message>> {
    const kv = this.ensureKvAvailable();
    const result = await kv.get('messages');
    if (result.ok && result.value) {
      return result.value as Record<number, Message>;
    }
    return {};
  }

  async deleteMessage(id: number): Promise<boolean> {
    const kv = this.ensureKvAvailable();
    const messagesData = await this.getAllMessagesData();
    
    if (messagesData[id]) {
      delete messagesData[id];
      await kv.set('messages', messagesData);
      return true;
    }
    return false;
  }
}

// Helper function to get Replit Database URL from file (production) or env var (development)
function getReplitDatabaseUrl(): string | null {
  // In production, Replit DB URL is stored in /tmp/replitdb file
  const REPLIT_DB_FILE = '/tmp/replitdb';
  
  try {
    if (fs.existsSync(REPLIT_DB_FILE)) {
      const dbUrl = fs.readFileSync(REPLIT_DB_FILE, 'utf-8').trim();
      if (dbUrl) {
        console.log('Replit Database URL found in /tmp/replitdb (production)');
        return dbUrl;
      }
    }
  } catch (error) {
    console.warn('Failed to read /tmp/replitdb:', error);
  }
  
  // In development, check environment variable
  if (process.env.REPLIT_DB_URL) {
    console.log('Replit Database URL found in environment variable (development)');
    return process.env.REPLIT_DB_URL;
  }
  
  return null;
}

// Conditional storage initialization based on environment
function createStorage(): IStorage {
  // Check if we're in a Replit environment (has REPLIT_DB_URL)
  const replitDbUrl = getReplitDatabaseUrl();
  if (replitDbUrl) {
    console.log('Using Replit Database storage');
    return new KeyValueStorage();
  }
  
  // Check if we have a PostgreSQL database URL (local development)
  if (process.env.DATABASE_URL) {
    console.log('Using PostgreSQL Database storage');
    return new DatabaseStorage();
  }
  
  // Fallback to in-memory storage for testing
  console.log('Using in-memory storage (no database configured)');
  return new MemStorage();
}

export const storage = createStorage();
