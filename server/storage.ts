import { users, type User, type InsertUser, rsvp, type Rsvp, type InsertRsvp } from "@shared/schema";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  createRsvp(rsvpData: InsertRsvp): Promise<Rsvp>;
  updateRsvp(id: number, rsvpData: InsertRsvp): Promise<Rsvp>;
  getRsvps(): Promise<Rsvp[]>;
  getRsvpByEmail(email: string): Promise<Rsvp | undefined>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private rsvps: Map<number, Rsvp>;
  currentUserId: number;
  currentRsvpId: number;

  constructor() {
    this.users = new Map();
    this.rsvps = new Map();
    this.currentUserId = 1;
    this.currentRsvpId = 1;
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
}

export const storage = new MemStorage();
