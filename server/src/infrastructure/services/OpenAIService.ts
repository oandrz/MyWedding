import OpenAI from 'openai';
import { ThemePreferences, WeddingTheme } from '../../domain/entities/WeddingTheme';

export class OpenAIService {
  private openai: OpenAI;

  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }
    
    this.openai = new OpenAI({ 
      apiKey: process.env.OPENAI_API_KEY 
    });
  }

  async generateWeddingThemes(preferences: ThemePreferences): Promise<Partial<WeddingTheme>[]> {
    try {
      const prompt = this.buildThemePrompt(preferences);
      
      // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
      const response = await this.openai.chat.completions.create({
        model: "gpt-5",
        messages: [
          {
            role: "system",
            content: "You are a professional wedding planner with expertise in creating unique, personalized wedding themes. Generate creative and practical wedding theme suggestions based on the couple's preferences. Respond with JSON array only."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.8,
        max_tokens: 2000
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error('No response from AI');
      }

      const result = JSON.parse(content);
      return result.themes || [];
    } catch (error) {
      console.error('Error generating wedding themes:', error);
      throw new Error('Failed to generate wedding themes');
    }
  }

  private buildThemePrompt(preferences: ThemePreferences): string {
    return `Generate 3 unique wedding theme suggestions based on these preferences:
    
    Season: ${preferences.season}
    Formality Level: ${preferences.formality}
    Venue Type: ${preferences.venueType || 'flexible'}
    Color Preference: ${preferences.colorPreference || 'open to suggestions'}
    Budget: ${preferences.budget}
    Guest Count: ${preferences.guestCount}
    Personal Style: ${preferences.personalStyle || 'classic'}
    Cultural Elements: ${preferences.culturalElements || 'none specified'}
    
    For each theme, provide a JSON object with this exact structure:
    {
      "themes": [
        {
          "name": "Theme Name",
          "description": "Detailed description of the theme (2-3 sentences)",
          "season": "${preferences.season}",
          "colors": {
            "primary": "#hexcolor",
            "secondary": "#hexcolor",
            "accent": "#hexcolor",
            "background": "#hexcolor"
          },
          "style": {
            "formality": "${preferences.formality}",
            "atmosphere": "Description of the atmosphere",
            "decorStyle": "Description of decoration style"
          },
          "keywords": ["keyword1", "keyword2", "keyword3"],
          "suggestedVenue": ["venue1", "venue2"],
          "flowerSuggestions": ["flower1", "flower2", "flower3"],
          "musicStyle": ["genre1", "genre2"]
        }
      ]
    }
    
    Make each theme unique and tailored to the preferences. Include practical implementation details.`;
  }

  async generateThemeDescription(themeName: string): Promise<string> {
    try {
      // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
      const response = await this.openai.chat.completions.create({
        model: "gpt-5",
        messages: [
          {
            role: "system",
            content: "You are a wedding planning expert. Provide detailed, inspiring descriptions for wedding themes."
          },
          {
            role: "user",
            content: `Provide a detailed, romantic description for a wedding theme called "${themeName}". Include specific decoration ideas, atmosphere, and implementation tips. Keep it to 3-4 sentences.`
          }
        ],
        temperature: 0.7,
        max_tokens: 200
      });

      return response.choices[0].message.content || 'A beautiful wedding theme perfect for your special day.';
    } catch (error) {
      console.error('Error generating theme description:', error);
      return 'A beautiful wedding theme perfect for your special day.';
    }
  }
}