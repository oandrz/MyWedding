import { IWeddingThemeRepository } from '../../domain/repositories/IWeddingThemeRepository';
import { WeddingTheme } from '../../domain/entities/WeddingTheme';
import Database from '@replit/database';

export class KVWeddingThemeRepository implements IWeddingThemeRepository {
  private db: Database;
  private readonly THEME_PREFIX = 'theme:';
  private readonly THEME_LIST_KEY = 'theme_list';

  constructor() {
    this.db = new Database();
  }

  async create(theme: WeddingTheme): Promise<WeddingTheme> {
    const key = `${this.THEME_PREFIX}${theme.id}`;
    
    // Store theme data
    await this.db.set(key, {
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
      createdAt: theme.createdAt.toISOString()
    });
    
    // Update theme list
    const themeList = await this.getThemeList();
    themeList.push({
      id: theme.id,
      createdAt: theme.createdAt.toISOString()
    });
    await this.db.set(this.THEME_LIST_KEY, themeList);
    
    return theme;
  }

  async findById(id: number): Promise<WeddingTheme | null> {
    const key = `${this.THEME_PREFIX}${id}`;
    const data = await this.db.get(key);
    
    if (!data) {
      return null;
    }
    
    return this.deserializeTheme(data);
  }

  async findAll(): Promise<WeddingTheme[]> {
    const themeList = await this.getThemeList();
    const themes: WeddingTheme[] = [];
    
    for (const item of themeList) {
      const theme = await this.findById(item.id);
      if (theme) {
        themes.push(theme);
      }
    }
    
    return themes;
  }

  async findRecent(limit: number): Promise<WeddingTheme[]> {
    const themeList = await this.getThemeList();
    
    // Sort by createdAt descending
    themeList.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    
    // Get the most recent themes
    const recentList = themeList.slice(0, limit);
    const themes: WeddingTheme[] = [];
    
    for (const item of recentList) {
      const theme = await this.findById(item.id);
      if (theme) {
        themes.push(theme);
      }
    }
    
    return themes;
  }

  async deleteOld(daysOld: number): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    const themeList = await this.getThemeList();
    const updatedList: any[] = [];
    
    for (const item of themeList) {
      const createdAt = new Date(item.createdAt);
      if (createdAt > cutoffDate) {
        updatedList.push(item);
      } else {
        // Delete old theme
        const key = `${this.THEME_PREFIX}${item.id}`;
        await this.db.delete(key);
      }
    }
    
    await this.db.set(this.THEME_LIST_KEY, updatedList);
  }

  private async getThemeList(): Promise<any[]> {
    try {
      const list = await this.db.get(this.THEME_LIST_KEY);
      return Array.isArray(list) ? list : [];
    } catch (error) {
      console.error('Error getting theme list:', error);
      return [];
    }
  }

  private deserializeTheme(data: any): WeddingTheme {
    return new WeddingTheme(
      data.id,
      data.name,
      data.description,
      data.season,
      data.colors,
      data.style,
      data.keywords,
      data.suggestedVenue,
      data.flowerSuggestions,
      data.musicStyle,
      new Date(data.createdAt)
    );
  }
}