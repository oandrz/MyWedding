import { users, type User, type InsertUser, rsvp, type Rsvp, type InsertRsvp, media, type Media, type InsertMedia, configImages, type ConfigImage, type InsertConfigImage } from "@shared/schema";
import { eq, desc, sql } from "drizzle-orm";
import { db } from "./db";

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
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private rsvps: Map<number, Rsvp>;
  private medias: Map<number, Media>;
  private configImages: Map<string, ConfigImage>;
  currentUserId: number;
  currentRsvpId: number;
  currentMediaId: number;
  currentConfigImageId: number;

  constructor() {
    this.users = new Map();
    this.rsvps = new Map();
    this.medias = new Map();
    this.configImages = new Map();
    this.currentUserId = 1;
    this.currentRsvpId = 1;
    this.currentMediaId = 1;
    this.currentConfigImageId = 1;

    // Initialize default images
    this.initializeDefaultImages();
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
    // Handle optional fields to match the Rsvp type
    const rsvpEntry: Rsvp = { 
      ...insertRsvp, 
      id,
      message: insertRsvp.message ?? null,
      guestCount: insertRsvp.guestCount ?? null,
      dietaryRestrictions: insertRsvp.dietaryRestrictions ?? null
    };
    this.rsvps.set(id, rsvpEntry);
    return rsvpEntry;
  }
  
  async getRsvps(): Promise<Rsvp[]> {
    return Array.from(this.rsvps.values());
  }
  
  async updateRsvp(id: number, insertRsvp: InsertRsvp): Promise<Rsvp> {
    // Handle optional fields to match the Rsvp type
    const rsvpEntry: Rsvp = { 
      ...insertRsvp, 
      id,
      message: insertRsvp.message ?? null,
      guestCount: insertRsvp.guestCount ?? null,
      dietaryRestrictions: insertRsvp.dietaryRestrictions ?? null
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
    // Handle optional fields to match the Media type
    const mediaEntry: Media = {
      ...insertMedia,
      id,
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
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async createRsvp(insertRsvp: InsertRsvp): Promise<Rsvp> {
    const [rsvpEntry] = await db
      .insert(rsvp)
      .values(insertRsvp)
      .returning();
    return rsvpEntry;
  }

  async updateRsvp(id: number, insertRsvp: InsertRsvp): Promise<Rsvp> {
    const [rsvpEntry] = await db
      .update(rsvp)
      .set(insertRsvp)
      .where(eq(rsvp.id, id))
      .returning();
    return rsvpEntry;
  }

  async getRsvps(): Promise<Rsvp[]> {
    return db.select().from(rsvp);
  }

  async getRsvpByEmail(email: string): Promise<Rsvp | undefined> {
    const normalizedEmail = email.toLowerCase();
    const [rsvpEntry] = await db
      .select()
      .from(rsvp)
      .where(sql`LOWER(${rsvp.email}) = ${normalizedEmail}`);
    return rsvpEntry || undefined;
  }

  async createMedia(insertMedia: InsertMedia): Promise<Media> {
    const [mediaEntry] = await db
      .insert(media)
      .values(insertMedia)
      .returning();
    return mediaEntry;
  }

  async getMediaById(id: number): Promise<Media | undefined> {
    const [mediaEntry] = await db
      .select()
      .from(media)
      .where(eq(media.id, id));
    return mediaEntry || undefined;
  }

  async getAllMedia(): Promise<Media[]> {
    return db
      .select()
      .from(media)
      .orderBy(desc(media.createdAt));
  }

  async getApprovedMedia(): Promise<Media[]> {
    return db
      .select()
      .from(media)
      .where(eq(media.approved, true))
      .orderBy(desc(media.createdAt));
  }

  async updateMediaApproval(id: number, approved: boolean): Promise<Media | undefined> {
    const [mediaEntry] = await db
      .update(media)
      .set({ approved })
      .where(eq(media.id, id))
      .returning();
    return mediaEntry || undefined;
  }

  // Configurable images methods
  async createConfigImage(insertConfigImage: InsertConfigImage): Promise<ConfigImage> {
    const [configImage] = await db
      .insert(configImages)
      .values(insertConfigImage)
      .returning();
    return configImage;
  }

  async updateConfigImage(imageKey: string, insertConfigImage: InsertConfigImage): Promise<ConfigImage> {
    const [configImage] = await db
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
    const [configImage] = await db
      .select()
      .from(configImages)
      .where(eq(configImages.imageKey, imageKey));
    return configImage || undefined;
  }

  async getConfigImagesByType(imageType: string): Promise<ConfigImage[]> {
    return db
      .select()
      .from(configImages)
      .where(sql`${configImages.imageType} = ${imageType} AND ${configImages.isActive} = true`)
      .orderBy(desc(configImages.updatedAt));
  }

  async getAllConfigImages(): Promise<ConfigImage[]> {
    return db
      .select()
      .from(configImages)
      .orderBy(desc(configImages.updatedAt));
  }

  async deleteConfigImage(imageKey: string): Promise<boolean> {
    const result = await db
      .delete(configImages)
      .where(eq(configImages.imageKey, imageKey));
    return result.rowCount > 0;
  }
}

// Use database storage since schema is pushed
export const storage = new MemStorage();

// Uncomment to use MemStorage for development/testing
// export const storage = new MemStorage();
