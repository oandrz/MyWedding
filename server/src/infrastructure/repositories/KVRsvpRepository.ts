import Database from '@replit/database';
import { Rsvp } from '../../domain/entities/Rsvp';
import { IRsvpRepository } from '../../domain/repositories/IRsvpRepository';

export class KVRsvpRepository implements IRsvpRepository {
  private kv: Database;
  private currentId: number = 1;

  constructor() {
    this.kv = new Database();
    this.initializeId();
  }

  private async initializeId(): Promise<void> {
    const keys = await this.kv.list('rsvp:');
    if (keys.ok && keys.value.length > 0) {
      const ids = keys.value.map(key => 
        parseInt(key.toString().split(':')[1])
      ).filter(id => !isNaN(id));
      this.currentId = Math.max(...ids, 0) + 1;
    }
  }

  async create(rsvp: Rsvp): Promise<Rsvp> {
    const id = this.currentId++;
    const rsvpWithId = new Rsvp(id, rsvp.name, rsvp.email, rsvp.attending, rsvp.guestCount);
    
    const data = this.toStorageFormat(rsvpWithId);
    await this.kv.set(`rsvp:${id}`, data);
    return rsvpWithId;
  }

  async update(rsvp: Rsvp): Promise<Rsvp> {
    const data = this.toStorageFormat(rsvp);
    await this.kv.set(`rsvp:${rsvp.id}`, data);
    return rsvp;
  }

  async findById(id: number): Promise<Rsvp | null> {
    const result = await this.kv.get(`rsvp:${id}`);
    if (!result.ok || !result.value) return null;
    return this.fromStorageFormat(result.value);
  }

  async findByEmail(email: string): Promise<Rsvp | null> {
    const keysResult = await this.kv.list('rsvp:');
    if (!keysResult.ok) return null;
    
    for (const key of keysResult.value) {
      const result = await this.kv.get(key);
      if (result.ok && result.value) {
        const rsvp = this.fromStorageFormat(result.value);
        if (rsvp.email.toLowerCase() === email.toLowerCase()) {
          return rsvp;
        }
      }
    }
    return null;
  }

  async findAll(): Promise<Rsvp[]> {
    const keysResult = await this.kv.list('rsvp:');
    if (!keysResult.ok) return [];
    
    const rsvps: Rsvp[] = [];
    for (const key of keysResult.value) {
      const result = await this.kv.get(key);
      if (result.ok && result.value) {
        rsvps.push(this.fromStorageFormat(result.value));
      }
    }
    return rsvps;
  }

  private toStorageFormat(rsvp: Rsvp): any {
    return {
      id: rsvp.id,
      name: rsvp.name,
      email: rsvp.email,
      attending: rsvp.attending,
      guestCount: rsvp.guestCount
    };
  }

  private fromStorageFormat(data: any): Rsvp {
    return new Rsvp(
      data.id,
      data.name,
      data.email,
      data.attending,
      data.guestCount
    );
  }
}