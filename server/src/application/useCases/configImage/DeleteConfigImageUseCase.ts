import { IConfigImageRepository } from '../../../domain/repositories/IConfigImageRepository';

export class DeleteConfigImageUseCase {
  constructor(private readonly configImageRepository: IConfigImageRepository) {}

  async execute(imageKey: string): Promise<boolean> {
    const existingImage = await this.configImageRepository.findByKey(imageKey);
    
    if (!existingImage) {
      throw new Error(`Config image with key '${imageKey}' not found`);
    }
    
    return await this.configImageRepository.delete(imageKey);
  }
}