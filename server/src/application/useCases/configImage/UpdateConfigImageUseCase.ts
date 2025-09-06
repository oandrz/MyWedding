import { ConfigImage } from '../../../domain/entities/ConfigImage';
import { IConfigImageRepository } from '../../../domain/repositories/IConfigImageRepository';

export interface UpdateConfigImageRequest {
  imageKey: string;
  imageUrl: string;
  title?: string | null;
  description?: string | null;
  isActive?: boolean;
}

export class UpdateConfigImageUseCase {
  constructor(private readonly configImageRepository: IConfigImageRepository) {}

  async execute(request: UpdateConfigImageRequest): Promise<ConfigImage> {
    const existing = await this.configImageRepository.findByKey(request.imageKey);
    
    const image = ConfigImage.create({
      id: existing?.id,
      imageKey: request.imageKey,
      imageUrl: request.imageUrl,
      imageType: existing?.imageType ?? 'other',
      title: request.title ?? existing?.title ?? null,
      description: request.description ?? existing?.description ?? null,
      isActive: request.isActive ?? existing?.isActive ?? true
    });
    
    return await this.configImageRepository.update(image);
  }
}