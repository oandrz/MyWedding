import { Rsvp } from '../../../domain/entities/Rsvp';
import { IRsvpRepository } from '../../../domain/repositories/IRsvpRepository';

export interface RsvpStatistics {
  totalInvited: number;
  totalAttending: number;
  totalNotAttending: number;
  totalGuests: number;
}

export class GetAllRsvpsUseCase {
  constructor(private readonly rsvpRepository: IRsvpRepository) {}

  async execute(): Promise<{ rsvps: Rsvp[]; statistics: RsvpStatistics }> {
    const rsvps = await this.rsvpRepository.findAll();
    
    const statistics = this.calculateStatistics(rsvps);
    
    return { rsvps, statistics };
  }

  private calculateStatistics(rsvps: Rsvp[]): RsvpStatistics {
    const totalInvited = rsvps.length;
    const attendingRsvps = rsvps.filter(r => r.attending);
    const totalAttending = attendingRsvps.length;
    const totalNotAttending = rsvps.filter(r => !r.attending).length;
    const totalGuests = attendingRsvps.reduce(
      (sum, rsvp) => sum + rsvp.getTotalAttendees(),
      0
    );
    
    return {
      totalInvited,
      totalAttending,
      totalNotAttending,
      totalGuests
    };
  }
}