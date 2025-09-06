import { Media } from '../../../domain/entities/Media';
import { IMediaRepository } from '../../../domain/repositories/IMediaRepository';

export class ApproveMediaUseCase {
  constructor(private readonly mediaRepository: IMediaRepository) {}

  async execute(mediaId: number, approve: boolean): Promise<Media> {
    const media = await this.mediaRepository.findById(mediaId);
    
    if (!media) {
      throw new Error(`Media with id ${mediaId} not found`);
    }
    
    const updatedMedia = approve ? media.approve() : media.reject();
    
    return await this.mediaRepository.update(updatedMedia);
  }
}