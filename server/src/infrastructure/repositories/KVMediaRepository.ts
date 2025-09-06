import Database from '@replit/database';
import { Media } from '../../domain/entities/Media';
import { IMediaRepository } from '../../domain/repositories/IMediaRepository';

export class KVMediaRepository implements IMediaRepository {
  private kv: Database;
  private currentId: number = 1;

  constructor() {
    this.kv = new Database();
    this.initializeId();
  }

  private async initializeId(): Promise<void> {
    const keys = await this.kv.list('media:');
    if (keys.ok && keys.value.length > 0) {
      const ids = keys.value.map(key => 
        parseInt(key.toString().split(':')[1])
      ).filter(id => !isNaN(id));
      this.currentId = Math.max(...ids, 0) + 1;
    }
  }

  async create(media: Media): Promise<Media> {
    const id = this.currentId++;
    const mediaWithId = Media.create({
      id,
      name: media.name,
      email: media.email,
      mediaUrl: media.mediaUrl,
      mediaType: media.mediaType,
      caption: media.caption,
      approved: media.approved,
      createdAt: media.createdAt
    });
    
    const data = this.toStorageFormat(mediaWithId);
    await this.kv.set(`media:${id}`, data);
    return mediaWithId;
  }

  async update(media: Media): Promise<Media> {
    const data = this.toStorageFormat(media);
    await this.kv.set(`media:${media.id}`, data);
    return media;
  }

  async findById(id: number): Promise<Media | null> {
    const result = await this.kv.get(`media:${id}`);
    if (!result.ok || !result.value) return null;
    return this.fromStorageFormat(result.value);
  }

  async findAll(): Promise<Media[]> {
    const keysResult = await this.kv.list('media:');
    if (!keysResult.ok) return [];
    
    const medias: Media[] = [];
    for (const key of keysResult.value) {
      const result = await this.kv.get(key);
      if (result.ok && result.value) {
        medias.push(this.fromStorageFormat(result.value));
      }
    }
    return medias.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async findApproved(): Promise<Media[]> {
    const allMedia = await this.findAll();
    return allMedia.filter(m => m.approved);
  }

  async findPending(): Promise<Media[]> {
    const allMedia = await this.findAll();
    return allMedia.filter(m => !m.approved);
  }

  private toStorageFormat(media: Media): any {
    return {
      id: media.id,
      name: media.name,
      email: media.email,
      mediaUrl: media.mediaUrl,
      mediaType: media.mediaType,
      caption: media.caption,
      approved: media.approved,
      createdAt: media.createdAt.toISOString()
    };
  }

  private fromStorageFormat(data: any): Media {
    return new Media(
      data.id,
      data.name,
      data.email,
      data.mediaUrl,
      data.mediaType,
      data.caption,
      data.approved,
      new Date(data.createdAt)
    );
  }
}