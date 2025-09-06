import { WeddingTheme } from '../entities/WeddingTheme';

export interface IWeddingThemeRepository {
  create(theme: WeddingTheme): Promise<WeddingTheme>;
  findById(id: number): Promise<WeddingTheme | null>;
  findAll(): Promise<WeddingTheme[]>;
  findRecent(limit: number): Promise<WeddingTheme[]>;
  deleteOld(daysOld: number): Promise<void>;
}