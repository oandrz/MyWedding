import { IWeddingThemeRepository } from '../../../domain/repositories/IWeddingThemeRepository';
import { WeddingTheme, ThemePreferences } from '../../../domain/entities/WeddingTheme';
import { OpenAIService } from '../../../infrastructure/services/OpenAIService';

export class GenerateThemeSuggestionsUseCase {
  constructor(
    private themeRepository: IWeddingThemeRepository,
    private openAIService: OpenAIService
  ) {}

  async execute(preferences: ThemePreferences): Promise<WeddingTheme[]> {
    try {
      // Generate themes using AI
      const aiThemes = await this.openAIService.generateWeddingThemes(preferences);
      
      // Convert AI suggestions to domain entities and save them
      const themes: WeddingTheme[] = [];
      
      for (const aiTheme of aiThemes) {
        if (this.isValidTheme(aiTheme)) {
          const theme = WeddingTheme.create({
            name: aiTheme.name!,
            description: aiTheme.description!,
            season: aiTheme.season!,
            colors: aiTheme.colors!,
            style: aiTheme.style!,
            keywords: aiTheme.keywords || [],
            suggestedVenue: aiTheme.suggestedVenue || [],
            flowerSuggestions: aiTheme.flowerSuggestions || [],
            musicStyle: aiTheme.musicStyle || []
          });
          
          // Save theme to repository
          const savedTheme = await this.themeRepository.create(theme);
          themes.push(savedTheme);
        }
      }
      
      // Sort themes by how well they match preferences
      themes.sort((a, b) => b.matchesPreferences(preferences) - a.matchesPreferences(preferences));
      
      // Clean up old themes (older than 7 days)
      await this.themeRepository.deleteOld(7);
      
      return themes;
    } catch (error) {
      console.error('Error generating theme suggestions:', error);
      throw new Error('Failed to generate wedding theme suggestions');
    }
  }

  private isValidTheme(theme: Partial<WeddingTheme>): boolean {
    return !!(
      theme.name &&
      theme.description &&
      theme.season &&
      theme.colors &&
      theme.style &&
      theme.colors.primary &&
      theme.colors.secondary
    );
  }
}