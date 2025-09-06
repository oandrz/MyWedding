import { Request, Response } from 'express';
import { CreateRsvpUseCase } from '../../application/useCases/rsvp/CreateRsvpUseCase';
import { GetAllRsvpsUseCase } from '../../application/useCases/rsvp/GetAllRsvpsUseCase';

export class RsvpController {
  constructor(
    private readonly createRsvpUseCase: CreateRsvpUseCase,
    private readonly getAllRsvpsUseCase: GetAllRsvpsUseCase
  ) {}

  async createRsvp(req: Request, res: Response): Promise<void> {
    try {
      const { name, email, attending, guestCount } = req.body;
      
      if (!name || !email || attending === undefined) {
        res.status(400).json({ error: 'Name, email, and attending status are required' });
        return;
      }
      
      const rsvp = await this.createRsvpUseCase.execute({
        name,
        email,
        attending,
        guestCount: guestCount ?? null
      });
      
      const response = this.mapRsvpToResponse(rsvp);
      res.status(201).json({
        message: `RSVP ${response.attending ? 'confirmed' : 'declined'} for ${response.name}`,
        rsvp: response
      });
    } catch (error) {
      console.error('Error creating RSVP:', error);
      res.status(500).json({ error: 'Failed to create RSVP' });
    }
  }

  async getAllRsvps(req: Request, res: Response): Promise<void> {
    try {
      const { rsvps, statistics } = await this.getAllRsvpsUseCase.execute();
      
      const response = {
        rsvps: rsvps.map(r => this.mapRsvpToResponse(r)),
        statistics
      };
      
      res.json(response);
    } catch (error) {
      console.error('Error fetching RSVPs:', error);
      res.status(500).json({ error: 'Failed to fetch RSVPs' });
    }
  }

  private mapRsvpToResponse(rsvp: any) {
    return {
      id: rsvp.id,
      name: rsvp.name,
      email: rsvp.email,
      attending: rsvp.attending,
      guestCount: rsvp.guestCount
    };
  }
}