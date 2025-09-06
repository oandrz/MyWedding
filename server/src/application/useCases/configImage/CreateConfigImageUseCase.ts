import { ConfigImage } from '../../../domain/entities/ConfigImage';
import { IConfigImageRepository } from '../../../domain/repositories/IConfigImageRepository';

export interface CreateConfigImageRequest {
  imageKey: string;
  imageUrl: string;
  imageType: 'banner' | 'gallery' | 'other';
  title?: string | null;
  description?: string | null;
  isActive?: boolean;
}

export class CreateConfigImageUseCase {
  constructor(private readonly configImageRepository: IConfigImageRepository) {}

  async execute(request: CreateConfigImageRequest): Promise<ConfigImage> {
    const newImage = ConfigImage.create({
      imageKey: request.imageKey,
      imageUrl: request.imageUrl,
      imageType: request.imageType,
      title: request.title ?? null,
      description: request.description ?? null,
      isActive: request.isActive ?? true
    });
    
    return await this.configImageRepository.create(newImage);
  }
}