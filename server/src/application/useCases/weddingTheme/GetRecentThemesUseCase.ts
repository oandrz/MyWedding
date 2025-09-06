import { IWeddingThemeRepository } from '../../../domain/repositories/IWeddingThemeRepository';
import { WeddingTheme } from '../../../domain/entities/WeddingTheme';

export class GetRecentThemesUseCase {
  constructor(private themeRepository: IWeddingThemeRepository) {}

  async execute(limit: number = 10): Promise<WeddingTheme[]> {
    return await this.themeRepository.findRecent(limit);
  }
}