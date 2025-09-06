import { ConfigImage } from '../../../domain/entities/ConfigImage';
import { IConfigImageRepository } from '../../../domain/repositories/IConfigImageRepository';

export class GetConfigImagesByTypeUseCase {
  constructor(private readonly configImageRepository: IConfigImageRepository) {}

  async execute(imageType: 'banner' | 'gallery' | 'other'): Promise<ConfigImage[]> {
    return await this.configImageRepository.findByType(imageType);
  }
}