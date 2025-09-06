import { Request, Response } from 'express';
import { GenerateThemeSuggestionsUseCase } from '../../application/useCases/weddingTheme/GenerateThemeSuggestionsUseCase';
import { GetRecentThemesUseCase } from '../../application/useCases/weddingTheme/GetRecentThemesUseCase';
import { ThemePreferences } from '../../domain/entities/WeddingTheme';

export class WeddingThemeController {
  constructor(
    private generateThemesUseCase: GenerateThemeSuggestionsUseCase,
    private getRecentThemesUseCase: GetRecentThemesUseCase
  ) {}

  async generateThemes(req: Request, res: Response): Promise<void> {
    try {
      const preferences: ThemePreferences = req.body;
      
      // Validate required fields
      if (!preferences.season || !preferences.formality || !preferences.budget || !preferences.guestCount) {
        res.status(400).json({ 
          error: 'Missing required fields: season, formality, budget, and guestCount are required' 
        });
        return;
      }
      
      // Generate themes using AI
      const themes = await this.generateThemesUseCase.execute(preferences);
      
      res.json({ 
        themes: themes.map(theme => ({
          id: theme.id,
          name: theme.name,
          description: theme.description,
          season: theme.season,
          colors: theme.colors,
          style: theme.style,
          keywords: theme.keywords,
          suggestedVenue: theme.suggestedVenue,
          flowerSuggestions: theme.flowerSuggestions,
          musicStyle: theme.musicStyle,
          matchScore: theme.matchesPreferences(preferences),
          createdAt: theme.createdAt
        }))
      });
    } catch (error) {
      console.error('Error generating themes:', error);
      res.status(500).json({ error: 'Failed to generate wedding themes' });
    }
  }

  async getRecentThemes(req: Request, res: Response): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const themes = await this.getRecentThemesUseCase.execute(limit);
      
      res.json({ 
        themes: themes.map(theme => ({
          id: theme.id,
          name: theme.name,
          description: theme.description,
          season: theme.season,
          colors: theme.colors,
          style: theme.style,
          keywords: theme.keywords,
          suggestedVenue: theme.suggestedVenue,
          flowerSuggestions: theme.flowerSuggestions,
          musicStyle: theme.musicStyle,
          createdAt: theme.createdAt
        }))
      });
    } catch (error) {
      console.error('Error getting recent themes:', error);
      res.status(500).json({ error: 'Failed to get recent themes' });
    }
  }
}