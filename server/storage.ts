import { users, type User, type InsertUser, rsvp, type Rsvp, type InsertRsvp, media, type Media, type InsertMedia, configImages, type ConfigImage, type InsertConfigImage, featureFlags, type FeatureFlag, type InsertFeatureFlag, appSettings, type AppSetting, type InsertAppSetting, welcomeScreen, type WelcomeScreen, type InsertWelcomeScreen, contentSections, type ContentSection, type InsertContentSection, contentEntries, type ContentEntry, type InsertContentEntry } from "@shared/schema";
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
  
  // Content sections methods
  getContentSection(sectionKey: string): Promise<ContentSection | undefined>;
  updateContentSection(sectionKey: string, data: any): Promise<ContentSection>;
  getAllContentSections(): Promise<ContentSection[]>;
  
  // Content entries methods
  getContentEntries(category: string): Promise<ContentEntry[]>;
  createContentEntry(entryData: InsertContentEntry): Promise<ContentEntry>;
  updateContentEntry(id: number, entryData: Partial<InsertContentEntry>): Promise<ContentEntry | undefined>;
  deleteContentEntry(id: number): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private rsvps: Map<number, Rsvp>;
  private medias: Map<number, Media>;
  private configImages: Map<string, ConfigImage>;
  private featureFlags: Map<string, FeatureFlag>;
  private appSettings: Map<string, AppSetting>;
  private welcomeScreenData: WelcomeScreen | null;
  private contentSectionsMap: Map<string, ContentSection>;
  private contentEntriesMap: Map<number, ContentEntry>;
  currentUserId: number;
  currentRsvpId: number;
  currentMediaId: number;
  currentConfigImageId: number;
  currentFeatureFlagId: number;
  currentAppSettingId: number;
  currentContentSectionId: number;
  currentContentEntryId: number;

  constructor() {
    this.users = new Map();
    this.rsvps = new Map();
    this.medias = new Map();
    this.configImages = new Map();
    this.featureFlags = new Map();
    this.appSettings = new Map();
    this.welcomeScreenData = null;
    this.contentSectionsMap = new Map();
    this.contentEntriesMap = new Map();
    this.currentUserId = 1;
    this.currentRsvpId = 1;
    this.currentMediaId = 1;
    this.currentConfigImageId = 1;
    this.currentFeatureFlagId = 1;
    this.currentAppSettingId = 1;
    this.currentContentSectionId = 1;
    this.currentContentEntryId = 1;

    // Initialize default images and feature flags
    this.initializeDefaultImages();
    this.initializeDefaultFeatureFlags();
    this.initializeDefaultAppSettings();
    this.initializeDefaultWelcomeScreen();
    this.initializeDefaultContent();
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
        imageType: 'gallery',
        title: `Gallery Image ${index + 1}`,
        description: `Default gallery image ${index + 1}`,
        isActive: true,
        updatedAt: new Date().toISOString()
      };
      this.configImages.set(`gallery_default_${index + 1}`, galleryImage);
    });
  }

  private initializeDefaultContent() {
    // Initialize content sections with hardcoded values
    const weddingDate = new Date('July 5, 2026 14:00:00');
    
    // Basic Info section
    const basicInfo: ContentSection = {
      id: this.currentContentSectionId++,
      sectionKey: 'basic_info',
      data: {
        groomName: 'Andreas',
        brideName: 'Christine Natasya Serena',
        weddingDate: weddingDate.toISOString(),
        weddingTime: '2:00 PM'
      },
      updatedAt: new Date().toISOString()
    };
    this.contentSectionsMap.set('basic_info', basicInfo);
    
    // Couple Story section
    const coupleStory: ContentSection = {
      id: this.currentContentSectionId++,
      sectionKey: 'couple_story',
      data: {
        groomBio: "Andreas is a software engineer with a talent for playing the guitar. He's an avid sports enthusiast who never misses a game and has a collection of vintage records that he treasures. His calm demeanor perfectly balances Christine Natasya Serena's energetic personality.",
        brideBio: "Christine Natasya Serena is a passionate kindergarten teacher who loves baking, hiking on weekends, and has an infectious laugh that lights up any room. She dreams of traveling the world and hopes to visit at least 30 countries in her lifetime.",
        ourStory: "Our story began five years ago at a mutual friend's birthday party. Christine Natasya Serena was helping with decorations when she accidentally spilled punch on Andreas's new shoes. What started as an awkward apology turned into hours of conversation, laughter, and the exchange of phone numbers. Three years, countless adventures, and one rescue dog later, Andreas proposed during a sunrise hike to our favorite mountain lookout."
      },
      updatedAt: new Date().toISOString()
    };
    this.contentSectionsMap.set('couple_story', coupleStory);
    
    // Venue Info section
    const venueInfo: ContentSection = {
      id: this.currentContentSectionId++,
      sectionKey: 'venue_info',
      data: {
        venueName: 'Casakhasa Kemang',
        address: 'Jl. Bungur No.20 1, RT.1/RW.5, Bangka, Kec. Mampang Prpt., Kota Jakarta Selatan, Daerah Khusus Ibukota Jakarta 12730, Indonesia',
        ceremonyTime: '2:00 PM - 3:30 PM',
        receptionTime: '4:30 PM - 10:00 PM',
        mapUrl: 'https://www.google.com/maps/place/Casakhasa/@-6.2594469,106.8204341,17z/data=!3m1!4b1!4m9!3m8!1s0x2e69f22adf2c9a27:0x118d6eaa20e4454b!5m2!4m1!1i2!8m2!3d-6.2594469!4d106.8204341!16s%2Fg%2F11bccm83__'
      },
      updatedAt: new Date().toISOString()
    };
    this.contentSectionsMap.set('venue_info', venueInfo);
    
    // Initialize schedule entries
    const scheduleItems = [
      {
        title: "Ceremony",
        time: "2:00 PM - 3:30 PM",
        description: "Exchange of vows and rings in a beautiful ceremony at St. Mary's Cathedral"
      },
      {
        title: "Cocktail Hour",
        time: "4:00 PM - 5:00 PM",
        description: "Enjoy hors d'oeuvres and drinks while the wedding party takes photos"
      },
      {
        title: "Dinner Reception",
        time: "5:30 PM - 7:30 PM",
        description: "Elegant dinner, toasts, and speeches celebrating the newlyweds"
      },
      {
        title: "Dancing & Celebration",
        time: "8:00 PM - 10:00 PM",
        description: "Dance the night away with music, cake cutting, and joyous celebration"
      }
    ];
    
    scheduleItems.forEach((item, index) => {
      const entry: ContentEntry = {
        id: this.currentContentEntryId++,
        category: 'schedule',
        order: index,
        data: item,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      this.contentEntriesMap.set(entry.id, entry);
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
    const defaultMusicSetting: AppSetting = {
      id: this.currentAppSettingId++,
      settingKey: 'background_music_url',
      settingValue: '/music/wedding-piano.mp3',
      settingType: 'audio',
      description: 'Background music file URL',
      updatedAt: new Date().toISOString()
    };
    this.appSettings.set('background_music_url', defaultMusicSetting);
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
  
  // Content sections methods
  async getContentSection(sectionKey: string): Promise<ContentSection | undefined> {
    return this.contentSectionsMap.get(sectionKey);
  }
  
  async updateContentSection(sectionKey: string, data: any): Promise<ContentSection> {
    if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
      throw new Error("Cannot update content section with empty or invalid data");
    }
    
    const existing = this.contentSectionsMap.get(sectionKey);
    const id = existing?.id ?? this.currentContentSectionId++;
    const now = new Date();
    
    // Merge new data with existing data instead of overwriting
    const existingData = (existing && typeof existing.data === 'object') ? existing.data : {};
    const mergedData = { ...existingData, ...data };
    
    const section: ContentSection = {
      id,
      sectionKey,
      data: mergedData,
      updatedAt: now.toISOString()
    };
    this.contentSectionsMap.set(sectionKey, section);
    return section;
  }
  
  async getAllContentSections(): Promise<ContentSection[]> {
    return Array.from(this.contentSectionsMap.values());
  }
  
  // Content entries methods
  async getContentEntries(category: string): Promise<ContentEntry[]> {
    return Array.from(this.contentEntriesMap.values())
      .filter(entry => entry.category === category)
      .sort((a, b) => a.order - b.order);
  }
  
  async createContentEntry(entryData: InsertContentEntry): Promise<ContentEntry> {
    const id = this.currentContentEntryId++;
    const now = new Date();
    const entry: ContentEntry = {
      ...entryData,
      id,
      order: entryData.order ?? 0,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };
    this.contentEntriesMap.set(id, entry);
    return entry;
  }
  
  async updateContentEntry(id: number, entryData: Partial<InsertContentEntry>): Promise<ContentEntry | undefined> {
    const existing = this.contentEntriesMap.get(id);
    if (!existing) return undefined;
    
    const now = new Date();
    
    // Merge data field to prevent loss of existing fields
    let mergedData = existing.data;
    if (entryData.data !== undefined) {
      const existingData = (typeof existing.data === 'object' && existing.data !== null) ? existing.data as Record<string, any> : {};
      const newData = (typeof entryData.data === 'object' && entryData.data !== null) ? entryData.data as Record<string, any> : {};
      mergedData = { ...existingData, ...newData };
    }
    
    const updated: ContentEntry = {
      ...existing,
      category: entryData.category ?? existing.category,
      order: entryData.order ?? existing.order,
      data: mergedData,
      id,
      updatedAt: now.toISOString()
    };
    this.contentEntriesMap.set(id, updated);
    return updated;
  }
  
  async deleteContentEntry(id: number): Promise<boolean> {
    return this.contentEntriesMap.delete(id);
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
  
  // Content sections methods
  async getContentSection(sectionKey: string): Promise<ContentSection | undefined> {
    const [section] = await getDb()
      .select()
      .from(contentSections)
      .where(eq(contentSections.sectionKey, sectionKey));
    return section || undefined;
  }
  
  async updateContentSection(sectionKey: string, data: any): Promise<ContentSection> {
    if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
      throw new Error("Cannot update content section with empty or invalid data");
    }
    
    // Get existing section to merge data
    const existing = await this.getContentSection(sectionKey);
    const existingData = (existing && typeof existing.data === 'object') ? existing.data as Record<string, any> : {};
    const mergedData = { ...existingData, ...data };
    
    const [section] = await getDb()
      .insert(contentSections)
      .values({ sectionKey, data: mergedData })
      .onConflictDoUpdate({
        target: contentSections.sectionKey,
        set: {
          data: mergedData,
          updatedAt: sql`now()`
        }
      })
      .returning();
    return section;
  }
  
  async getAllContentSections(): Promise<ContentSection[]> {
    return getDb()
      .select()
      .from(contentSections);
  }
  
  // Content entries methods
  async getContentEntries(category: string): Promise<ContentEntry[]> {
    return getDb()
      .select()
      .from(contentEntries)
      .where(eq(contentEntries.category, category))
      .orderBy(contentEntries.order);
  }
  
  async createContentEntry(entryData: InsertContentEntry): Promise<ContentEntry> {
    const [entry] = await getDb()
      .insert(contentEntries)
      .values(entryData)
      .returning();
    return entry;
  }
  
  async updateContentEntry(id: number, entryData: Partial<InsertContentEntry>): Promise<ContentEntry | undefined> {
    // Get existing entry to merge data
    const [existing] = await getDb()
      .select()
      .from(contentEntries)
      .where(eq(contentEntries.id, id));
    
    if (!existing) {
      return undefined;
    }
    
    // Merge data fields while preserving other fields
    const updateData: any = { updatedAt: sql`now()` };
    
    if (entryData.category !== undefined) {
      updateData.category = entryData.category;
    }
    
    if (entryData.order !== undefined) {
      updateData.order = entryData.order;
    }
    
    if (entryData.data !== undefined) {
      const existingData = (typeof existing.data === 'object' && existing.data !== null) ? existing.data as Record<string, any> : {};
      const newData = (typeof entryData.data === 'object' && entryData.data !== null) ? entryData.data as Record<string, any> : {};
      updateData.data = { ...existingData, ...newData };
    }
    
    const [entry] = await getDb()
      .update(contentEntries)
      .set(updateData)
      .where(eq(contentEntries.id, id))
      .returning();
    return entry || undefined;
  }
  
  async deleteContentEntry(id: number): Promise<boolean> {
    const result = await getDb()
      .delete(contentEntries)
      .where(eq(contentEntries.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Seed initial content sections on server startup
  async seedContentSections(): Promise<void> {
    console.log('Seeding initial content sections...');
    
    // Check if basic_info exists
    const basicInfo = await this.getContentSection('basic_info');
    if (!basicInfo) {
      await getDb()
        .insert(contentSections)
        .values({
          sectionKey: 'basic_info',
          data: {
            groomName: 'Andreas',
            brideName: 'Christine',
            weddingDate: '2026-07-05T14:00:00.000Z',
            weddingDateDisplay: 'July 5, 2026'
          }
        })
        .onConflictDoNothing();
      console.log('✓ Created basic_info section');
    }

    // Check if couple_story exists
    const coupleStory = await this.getContentSection('couple_story');
    if (!coupleStory) {
      await getDb()
        .insert(contentSections)
        .values({
          sectionKey: 'couple_story',
          data: {
            groomBio: '',
            brideBio: '',
            ourStory: ''
          }
        })
        .onConflictDoNothing();
      console.log('✓ Created couple_story section');
    }

    // Check if venue_info exists
    const venueInfo = await this.getContentSection('venue_info');
    if (!venueInfo) {
      await getDb()
        .insert(contentSections)
        .values({
          sectionKey: 'venue_info',
          data: {
            venueName: 'Casakhasa Kemang',
            venueAddress: 'Jl. Bungur No.20 1, RT.1/RW.5, Bangka, Kec. Mampang Prpt., Kota Jakarta Selatan, Daerah Khusus Ibukota Jakarta 12730, Indonesia',
            ceremonyTime: '2:00 PM - 3:30 PM',
            receptionTime: '4:30 PM - 10:00 PM',
            mapUrl: 'https://www.google.com/maps/place/Casakhasa/@-6.2594469,106.8204341,17z'
          }
        })
        .onConflictDoNothing();
      console.log('✓ Created venue_info section');
    }

    console.log('Content sections seeding complete');
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
    // Initialize default feature flags if they don't exist
    const existingFlags = await this.getAllFeatureFlags();
    if (existingFlags.length === 0) {
      await this.initializeDefaultFeatureFlags();
    }

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

    // Initialize default content sections if they don't exist
    await this.seedContentSections();
  }

  private async initializeDefaultFeatureFlags() {
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
      }
    ];

    for (const feature of defaultFeatures) {
      const featureFlag: FeatureFlag = {
        id: this.currentFeatureFlagId++,
        ...feature,
        updatedAt: new Date().toISOString()
      };
      await kv.set(`feature_flag:${feature.featureKey}`, featureFlag);
    }
  }

  private async initializeDefaultImages() {
    const kv = this.ensureKvAvailable();
    // Default banner image
    const bannerImage: ConfigImage = {
      id: this.currentConfigImageId++,
      imageKey: 'banner',
      imageUrl: 'https://images.unsplash.com/photo-1469371670807-013ccf25f16a?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1920&q=80',
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
    
    const images = [];
    for (const key of keysResult.value) {
      const imageResult = await kv.get(key);
      if (imageResult.ok && imageResult.value && imageResult.value.imageType === imageType && imageResult.value.isActive) {
        images.push(imageResult.value);
      }
    }
    return images.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  async getAllConfigImages(): Promise<ConfigImage[]> {
    const kv = this.ensureKvAvailable();
    const keysResult = await kv.list("config_image:");
    if (!keysResult.ok) return [];
    
    const images = [];
    for (const key of keysResult.value) {
      const imageResult = await kv.get(key);
      if (imageResult.ok && imageResult.value) images.push(imageResult.value);
    }
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
    
    const flags = [];
    for (const key of keysResult.value) {
      const flagResult = await kv.get(key);
      if (flagResult.ok && flagResult.value) flags.push(flagResult.value);
    }
    return flags.sort((a, b) => a.featureName.localeCompare(b.featureName));
  }

  private async initializeDefaultAppSettings() {
    const kv = this.ensureKvAvailable();
    const defaultMusicSetting: AppSetting = {
      id: this.currentAppSettingId++,
      settingKey: 'background_music_url',
      settingValue: '/music/wedding-piano.mp3',
      settingType: 'audio',
      description: 'Background music file URL',
      updatedAt: new Date().toISOString()
    };
    await kv.set(`app_setting:background_music_url`, defaultMusicSetting);
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
    
    const settings = [];
    for (const key of keysResult.value) {
      const settingResult = await kv.get(key);
      if (settingResult.ok && settingResult.value) settings.push(settingResult.value);
    }
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
  
  // Content sections methods
  async getContentSection(sectionKey: string): Promise<ContentSection | undefined> {
    const kv = this.ensureKvAvailable();
    try {
      const section = await kv.get(`content_section:${sectionKey}`);
      return section || undefined;
    } catch (error) {
      console.error(`Error getting content section ${sectionKey}:`, error);
      return undefined;
    }
  }
  
  async updateContentSection(sectionKey: string, data: any): Promise<ContentSection> {
    if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
      throw new Error("Cannot update content section with empty or invalid data");
    }

    const kv = this.ensureKvAvailable();
    const existing = await this.getContentSection(sectionKey);
    const existingData = (existing && typeof existing.data === 'object') ? existing.data as Record<string, any> : {};
    const mergedData = { ...existingData, ...data };
    
    const section: ContentSection = {
      id: existing?.id || Date.now(),
      sectionKey,
      data: mergedData,
      updatedAt: new Date().toISOString()
    };
    
    await kv.set(`content_section:${sectionKey}`, section);
    return section;
  }
  
  async getAllContentSections(): Promise<ContentSection[]> {
    const kv = this.ensureKvAvailable();
    try {
      const sections: ContentSection[] = [];
      const keys = ['basic_info', 'couple_story', 'venue_info'];
      
      for (const key of keys) {
        const section = await kv.get(`content_section:${key}`);
        if (section) {
          sections.push(section);
        }
      }
      
      return sections;
    } catch (error) {
      console.error('Error getting all content sections:', error);
      return [];
    }
  }
  
  // Content entries methods
  async getContentEntries(category: string): Promise<ContentEntry[]> {
    const kv = this.ensureKvAvailable();
    try {
      const entries = await kv.get(`content_entries:${category}`);
      return entries || [];
    } catch (error) {
      console.error(`Error getting content entries for ${category}:`, error);
      return [];
    }
  }
  
  async createContentEntry(entryData: InsertContentEntry): Promise<ContentEntry> {
    const kv = this.ensureKvAvailable();
    const entries = await this.getContentEntries(entryData.category);
    
    const entry: ContentEntry = {
      id: Date.now(),
      ...entryData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    entries.push(entry);
    await kv.set(`content_entries:${entryData.category}`, entries);
    return entry;
  }
  
  async updateContentEntry(id: number, entryData: Partial<InsertContentEntry>): Promise<ContentEntry | undefined> {
    if (!entryData.category) {
      throw new Error("Category is required to update content entry");
    }

    const kv = this.ensureKvAvailable();
    const entries = await this.getContentEntries(entryData.category);
    const index = entries.findIndex(e => e.id === id);
    
    if (index === -1) {
      return undefined;
    }
    
    const existingData = (typeof entries[index].data === 'object' && entries[index].data !== null) 
      ? entries[index].data as Record<string, any> 
      : {};
    const newData = (typeof entryData.data === 'object' && entryData.data !== null) 
      ? entryData.data as Record<string, any> 
      : {};
    
    entries[index] = {
      ...entries[index],
      ...entryData,
      data: { ...existingData, ...newData },
      updatedAt: new Date().toISOString()
    };
    
    await kv.set(`content_entries:${entryData.category}`, entries);
    return entries[index];
  }
  
  async deleteContentEntry(id: number): Promise<boolean> {
    const kv = this.ensureKvAvailable();
    // Search all categories
    const categories = ['schedule']; // Add more categories as needed
    
    for (const category of categories) {
      const entries = await this.getContentEntries(category);
      const index = entries.findIndex(e => e.id === id);
      
      if (index !== -1) {
        entries.splice(index, 1);
        await kv.set(`content_entries:${category}`, entries);
        return true;
      }
    }
    
    return false;
  }

  // Seed initial content sections
  async seedContentSections(): Promise<void> {
    console.log('Seeding initial content sections...');
    const kv = this.ensureKvAvailable();
    
    // Check if basic_info exists
    const basicInfo = await this.getContentSection('basic_info');
    if (!basicInfo) {
      await kv.set('content_section:basic_info', {
        id: Date.now(),
        sectionKey: 'basic_info',
        data: {
          groomName: 'Andreas',
          brideName: 'Christine',
          weddingDate: '2026-07-05T14:00:00.000Z',
          weddingDateDisplay: 'July 5, 2026'
        },
        updatedAt: new Date().toISOString()
      });
      console.log('✓ Created basic_info section');
    }

    // Check if couple_story exists
    const coupleStory = await this.getContentSection('couple_story');
    if (!coupleStory) {
      await kv.set('content_section:couple_story', {
        id: Date.now() + 1,
        sectionKey: 'couple_story',
        data: {
          groomBio: '',
          brideBio: '',
          ourStory: ''
        },
        updatedAt: new Date().toISOString()
      });
      console.log('✓ Created couple_story section');
    }

    // Check if venue_info exists
    const venueInfo = await this.getContentSection('venue_info');
    if (!venueInfo) {
      await kv.set('content_section:venue_info', {
        id: Date.now() + 2,
        sectionKey: 'venue_info',
        data: {
          venueName: 'Casakhasa Kemang',
          venueAddress: 'Jl. Bungur No.20 1, RT.1/RW.5, Bangka, Kec. Mampang Prpt., Kota Jakarta Selatan, Daerah Khusus Ibukota Jakarta 12730, Indonesia',
          ceremonyTime: '2:00 PM - 3:30 PM',
          receptionTime: '4:30 PM - 10:00 PM',
          mapUrl: 'https://www.google.com/maps/place/Casakhasa/@-6.2594469,106.8204341,17z'
        },
        updatedAt: new Date().toISOString()
      });
      console.log('✓ Created venue_info section');
    }

    console.log('Content sections seeding complete');
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
