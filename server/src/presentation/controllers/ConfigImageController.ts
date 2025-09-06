import { Request, Response } from 'express';
import { CreateConfigImageUseCase } from '../../application/useCases/configImage/CreateConfigImageUseCase';
import { UpdateConfigImageUseCase } from '../../application/useCases/configImage/UpdateConfigImageUseCase';
import { GetConfigImagesByTypeUseCase } from '../../application/useCases/configImage/GetConfigImagesByTypeUseCase';
import { GetAllConfigImagesUseCase } from '../../application/useCases/configImage/GetAllConfigImagesUseCase';

export class ConfigImageController {
  constructor(
    private readonly createConfigImageUseCase: CreateConfigImageUseCase,
    private readonly updateConfigImageUseCase: UpdateConfigImageUseCase,
    private readonly getConfigImagesByTypeUseCase: GetConfigImagesByTypeUseCase,
    private readonly getAllConfigImagesUseCase: GetAllConfigImagesUseCase
  ) {}

  async createOrUpdateConfigImage(req: Request, res: Response): Promise<void> {
    try {
      const { imageKey, imageUrl, imageType, title, description, isActive } = req.body;
      
      if (!imageKey || !imageUrl || !imageType) {
        res.status(400).json({ error: 'Image key, URL, and type are required' });
        return;
      }
      
      const image = await this.updateConfigImageUseCase.execute({
        imageKey,
        imageUrl,
        title,
        description,
        isActive
      });
      
      res.json({
        message: 'Config image updated successfully',
        image: this.mapConfigImageToResponse(image)
      });
    } catch (error) {
      console.error('Error updating config image:', error);
      res.status(500).json({ error: 'Failed to update config image' });
    }
  }

  async getConfigImagesByType(req: Request, res: Response): Promise<void> {
    try {
      const { imageType } = req.params;
      
      if (!['banner', 'gallery', 'other'].includes(imageType)) {
        res.status(400).json({ error: 'Invalid image type' });
        return;
      }
      
      const images = await this.getConfigImagesByTypeUseCase.execute(
        imageType as 'banner' | 'gallery' | 'other'
      );
      
      res.json({
        images: images.map(img => this.mapConfigImageToResponse(img))
      });
    } catch (error) {
      console.error('Error fetching config images:', error);
      res.status(500).json({ error: 'Failed to fetch config images' });
    }
  }

  async getAllConfigImages(req: Request, res: Response): Promise<void> {
    try {
      const images = await this.getAllConfigImagesUseCase.execute();
      
      res.json({
        images: images.map(img => this.mapConfigImageToResponse(img))
      });
    } catch (error) {
      console.error('Error fetching all config images:', error);
      res.status(500).json({ error: 'Failed to fetch all config images' });
    }
  }

  private mapConfigImageToResponse(image: any) {
    return {
      id: image.id,
      imageKey: image.imageKey,
      imageUrl: image.imageUrl,
      imageType: image.imageType,
      title: image.title,
      description: image.description,
      isActive: image.isActive,
      updatedAt: image.updatedAt.toISOString()
    };
  }
}