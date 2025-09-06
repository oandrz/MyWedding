import { Request, Response } from 'express';
import { CreateMediaUseCase } from '../../application/useCases/media/CreateMediaUseCase';
import { ApproveMediaUseCase } from '../../application/useCases/media/ApproveMediaUseCase';
import { GetAllMediaUseCase } from '../../application/useCases/media/GetAllMediaUseCase';
import { GetApprovedMediaUseCase } from '../../application/useCases/media/GetApprovedMediaUseCase';

export class MediaController {
  constructor(
    private readonly createMediaUseCase: CreateMediaUseCase,
    private readonly approveMediaUseCase: ApproveMediaUseCase,
    private readonly getAllMediaUseCase: GetAllMediaUseCase,
    private readonly getApprovedMediaUseCase: GetApprovedMediaUseCase
  ) {}

  async createMedia(req: Request, res: Response): Promise<void> {
    try {
      const { name, email, caption } = req.body;
      const file = req.file;
      
      if (!file) {
        res.status(400).json({ error: 'Media file is required' });
        return;
      }
      
      const mediaUrl = `/uploads/${file.filename}`;
      const mediaType = file.mimetype.startsWith('video/') ? 'video' : 'image';
      
      const media = await this.createMediaUseCase.execute({
        name: name || 'Guest',
        email: email || 'guest@wedding.com',
        mediaUrl,
        mediaType,
        caption
      });
      
      res.status(201).json({
        message: 'Media uploaded successfully and pending approval',
        media: this.mapMediaToResponse(media)
      });
    } catch (error) {
      console.error('Error creating media:', error);
      res.status(500).json({ error: 'Failed to upload media' });
    }
  }

  async approveMedia(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { approved } = req.body;
      
      const mediaId = parseInt(id);
      if (isNaN(mediaId)) {
        res.status(400).json({ error: 'Invalid media ID' });
        return;
      }
      
      const media = await this.approveMediaUseCase.execute(mediaId, approved);
      
      res.json({
        message: `Media ${approved ? 'approved' : 'rejected'}`,
        media: this.mapMediaToResponse(media)
      });
    } catch (error: any) {
      console.error('Error approving media:', error);
      if (error.message?.includes('not found')) {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to update media approval' });
      }
    }
  }

  async getAllMedia(req: Request, res: Response): Promise<void> {
    try {
      const media = await this.getAllMediaUseCase.execute();
      
      res.json({
        media: media.map(m => this.mapMediaToResponse(m))
      });
    } catch (error) {
      console.error('Error fetching media:', error);
      res.status(500).json({ error: 'Failed to fetch media' });
    }
  }

  async getApprovedMedia(req: Request, res: Response): Promise<void> {
    try {
      const media = await this.getApprovedMediaUseCase.execute();
      
      res.json({
        media: media.map(m => this.mapMediaToResponse(m))
      });
    } catch (error) {
      console.error('Error fetching approved media:', error);
      res.status(500).json({ error: 'Failed to fetch approved media' });
    }
  }

  private mapMediaToResponse(media: any) {
    return {
      id: media.id,
      name: media.name,
      email: media.email,
      mediaUrl: media.mediaUrl,
      mediaType: media.mediaType,
      caption: media.caption,
      approved: media.approved,
      createdAt: media.createdAt.toISOString()
    };
  }
}