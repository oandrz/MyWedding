import { Media } from '../../../domain/entities/Media';
import { IMediaRepository } from '../../../domain/repositories/IMediaRepository';

export class GetAllMediaUseCase {
  constructor(private readonly mediaRepository: IMediaRepository) {}

  async execute(): Promise<Media[]> {
    return await this.mediaRepository.findAll();
  }
}