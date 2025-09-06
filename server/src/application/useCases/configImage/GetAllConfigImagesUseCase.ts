import { ConfigImage } from '../../../domain/entities/ConfigImage';
import { IConfigImageRepository } from '../../../domain/repositories/IConfigImageRepository';

export class GetAllConfigImagesUseCase {
  constructor(private readonly configImageRepository: IConfigImageRepository) {}

  async execute(): Promise<ConfigImage[]> {
    return await this.configImageRepository.findAll();
  }
}