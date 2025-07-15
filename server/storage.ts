import { users, type User, type InsertUser, rsvp, type Rsvp, type InsertRsvp, media, type Media, type InsertMedia } from "@shared/schema";
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
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private rsvps: Map<number, Rsvp>;
  private medias: Map<number, Media>;
  currentUserId: number;
  currentRsvpId: number;
  currentMediaId: number;

  constructor() {
    this.users = new Map();
    this.rsvps = new Map();
    this.medias = new Map();
    this.currentUserId = 1;
    this.currentRsvpId = 1;
    this.currentMediaId = 1;
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
}

// Use database storage since schema is pushed
export const storage = new MemStorage();

// Uncomment to use MemStorage for development/testing
// export const storage = new MemStorage();
