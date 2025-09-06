import { Rsvp } from '../../../domain/entities/Rsvp';
import { IRsvpRepository } from '../../../domain/repositories/IRsvpRepository';

export interface CreateRsvpRequest {
  name: string;
  email: string;
  attending: boolean;
  guestCount?: number | null;
}

export class CreateRsvpUseCase {
  constructor(private readonly rsvpRepository: IRsvpRepository) {}

  async execute(request: CreateRsvpRequest): Promise<Rsvp> {
    // Check if RSVP already exists for this email
    const existingRsvp = await this.rsvpRepository.findByEmail(request.email);
    
    if (existingRsvp) {
      // Update existing RSVP
      const updatedRsvp = new Rsvp(
        existingRsvp.id,
        request.name,
        request.email,
        request.attending,
        request.guestCount ?? null
      );
      return await this.rsvpRepository.update(updatedRsvp);
    }
    
    // Create new RSVP
    const newRsvp = Rsvp.create({
      name: request.name,
      email: request.email,
      attending: request.attending,
      guestCount: request.guestCount ?? null
    });
    
    return await this.rsvpRepository.create(newRsvp);
  }
}