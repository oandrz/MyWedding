import { Media } from '../../../domain/entities/Media';
import { IMediaRepository } from '../../../domain/repositories/IMediaRepository';

export interface CreateMediaRequest {
  name: string;
  email: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  caption?: string | null;
}

export class CreateMediaUseCase {
  constructor(private readonly mediaRepository: IMediaRepository) {}

  async execute(request: CreateMediaRequest): Promise<Media> {
    const newMedia = Media.create({
      name: request.name,
      email: request.email,
      mediaUrl: request.mediaUrl,
      mediaType: request.mediaType,
      caption: request.caption ?? null,
      approved: false // New media needs approval
    });
    
    return await this.mediaRepository.create(newMedia);
  }
}