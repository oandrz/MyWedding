import Database from '@replit/database';
import { ConfigImage } from '../../domain/entities/ConfigImage';
import { IConfigImageRepository } from '../../domain/repositories/IConfigImageRepository';

export class KVConfigImageRepository implements IConfigImageRepository {
  private kv: Database;
  private currentId: number = 1;

  constructor() {
    this.kv = new Database();
    this.initializeId();
    this.initializeDefaultImages();
  }

  private async initializeId(): Promise<void> {
    const keys = await this.kv.list('config_image:');
    if (keys.ok && keys.value.length > 0) {
      const images = await this.findAll();
      if (images.length > 0) {
        this.currentId = Math.max(...images.map(img => img.id)) + 1;
      }
    }
  }

  private async initializeDefaultImages(): Promise<void> {
    const existingImages = await this.findAll();
    if (existingImages.length === 0) {
      // Default banner image
      const bannerImage = ConfigImage.create({
        id: this.currentId++,
        imageKey: 'banner',
        imageUrl: 'https://images.unsplash.com/photo-1469371670807-013ccf25f16a',
        imageType: 'banner',
        title: 'Main Banner',
        description: 'Hero section background image',
        isActive: true
      });
      await this.create(bannerImage);

      // Default gallery images (just 2 for brevity)
      const galleryUrls = [
        'https://images.unsplash.com/photo-1522673607200-164d1b3ce475',
        'https://images.unsplash.com/photo-1494774157365-9e04c6720e47'
      ];

      for (let i = 0; i < galleryUrls.length; i++) {
        const galleryImage = ConfigImage.create({
          id: this.currentId++,
          imageKey: `gallery_default_${i + 1}`,
          imageUrl: galleryUrls[i],
          imageType: 'gallery',
          title: `Gallery Image ${i + 1}`,
          description: `Default gallery image ${i + 1}`,
          isActive: true
        });
        await this.create(galleryImage);
      }
    }
  }

  async create(image: ConfigImage): Promise<ConfigImage> {
    const data = this.toStorageFormat(image);
    await this.kv.set(`config_image:${image.imageKey}`, data);
    return image;
  }

  async update(image: ConfigImage): Promise<ConfigImage> {
    const data = this.toStorageFormat(image);
    await this.kv.set(`config_image:${image.imageKey}`, data);
    return image;
  }

  async delete(imageKey: string): Promise<boolean> {
    await this.kv.delete(`config_image:${imageKey}`);
    return true;
  }

  async findByKey(imageKey: string): Promise<ConfigImage | null> {
    const result = await this.kv.get(`config_image:${imageKey}`);
    if (!result.ok || !result.value) return null;
    return this.fromStorageFormat(result.value);
  }

  async findByType(imageType: 'banner' | 'gallery' | 'other'): Promise<ConfigImage[]> {
    const allImages = await this.findAll();
    return allImages.filter(img => img.imageType === imageType && img.isActive);
  }

  async findAll(): Promise<ConfigImage[]> {
    const keysResult = await this.kv.list('config_image:');
    if (!keysResult.ok) return [];
    
    const images: ConfigImage[] = [];
    for (const key of keysResult.value) {
      const result = await this.kv.get(key);
      if (result.ok && result.value) {
        images.push(this.fromStorageFormat(result.value));
      }
    }
    return images.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  private toStorageFormat(image: ConfigImage): any {
    return {
      id: image.id,
      imageKey: image.imageKey,
      imageUrl: image.imageUrl,
      imageType: image.imageType,
      title: image.title,
      description: image.description,
      isActive: image.isActive,
      updatedAt: image.updatedAt.toISOString()
    };
  }

  private fromStorageFormat(data: any): ConfigImage {
    return new ConfigImage(
      data.id,
      data.imageKey,
      data.imageUrl,
      data.imageType,
      data.title,
      data.description,
      data.isActive,
      new Date(data.updatedAt)
    );
  }
}