import { Rsvp } from '../entities/Rsvp';

export interface IRsvpRepository {
  create(rsvp: Rsvp): Promise<Rsvp>;
  update(rsvp: Rsvp): Promise<Rsvp>;
  findById(id: number): Promise<Rsvp | null>;
  findByEmail(email: string): Promise<Rsvp | null>;
  findAll(): Promise<Rsvp[]>;
}