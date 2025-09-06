import { ConfigImage } from '../entities/ConfigImage';

export interface IConfigImageRepository {
  create(image: ConfigImage): Promise<ConfigImage>;
  update(image: ConfigImage): Promise<ConfigImage>;
  delete(imageKey: string): Promise<boolean>;
  findByKey(imageKey: string): Promise<ConfigImage | null>;
  findByType(imageType: 'banner' | 'gallery' | 'other'): Promise<ConfigImage[]>;
  findAll(): Promise<ConfigImage[]>;
}