import { Media } from '../entities/Media';

export interface IMediaRepository {
  create(media: Media): Promise<Media>;
  update(media: Media): Promise<Media>;
  findById(id: number): Promise<Media | null>;
  findAll(): Promise<Media[]>;
  findApproved(): Promise<Media[]>;
  findPending(): Promise<Media[]>;
}