export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
}

export interface ThemeStyle {
  formality: 'casual' | 'semi-formal' | 'formal' | 'black-tie';
  atmosphere: string;
  decorStyle: string;
}

export class WeddingTheme {
  constructor(
    public readonly id: number,
    public readonly name: string,
    public readonly description: string,
    public readonly season: 'spring' | 'summer' | 'fall' | 'winter' | 'any',
    public readonly colors: ThemeColors,
    public readonly style: ThemeStyle,
    public readonly keywords: string[],
    public readonly suggestedVenue: string[],
    public readonly flowerSuggestions: string[],
    public readonly musicStyle: string[],
    public readonly createdAt: Date
  ) {
    this.validate();
  }

  private validate(): void {
    if (!this.name || this.name.trim().length === 0) {
      throw new Error('Theme name is required');
    }
    
    if (!this.description || this.description.trim().length === 0) {
      throw new Error('Theme description is required');
    }
    
    if (!this.colors.primary || !this.colors.secondary) {
      throw new Error('Primary and secondary colors are required');
    }
    
    if (this.keywords.length === 0) {
      throw new Error('At least one keyword is required');
    }
  }

  matchesPreferences(preferences: ThemePreferences): number {
    let score = 0;
    
    // Season match
    if (this.season === preferences.season || this.season === 'any') {
      score += 20;
    }
    
    // Style match
    if (this.style.formality === preferences.formality) {
      score += 15;
    }
    
    // Venue type match
    if (preferences.venueType && this.suggestedVenue.some(v => 
      v.toLowerCase().includes(preferences.venueType!.toLowerCase())
    )) {
      score += 15;
    }
    
    // Color preference match
    if (preferences.colorPreference) {
      const themeColors = Object.values(this.colors).join(' ').toLowerCase();
      if (themeColors.includes(preferences.colorPreference.toLowerCase())) {
        score += 10;
      }
    }
    
    // Budget consideration (formal themes for higher budgets)
    const formalityScore = {
      'casual': 1,
      'semi-formal': 2,
      'formal': 3,
      'black-tie': 4
    };
    
    const budgetFormalityMatch = Math.abs(
      formalityScore[this.style.formality] - 
      (preferences.budget === 'luxury' ? 4 : preferences.budget === 'moderate' ? 2 : 1)
    );
    score += Math.max(0, 10 - budgetFormalityMatch * 3);
    
    return score;
  }

  static create(params: {
    name: string;
    description: string;
    season: 'spring' | 'summer' | 'fall' | 'winter' | 'any';
    colors: ThemeColors;
    style: ThemeStyle;
    keywords: string[];
    suggestedVenue: string[];
    flowerSuggestions: string[];
    musicStyle: string[];
    id?: number; 
    createdAt?: Date 
  }): WeddingTheme {
    const id = params.id || Date.now();
    const createdAt = params.createdAt || new Date();
    
    return new WeddingTheme(
      id,
      params.name,
      params.description,
      params.season,
      params.colors,
      params.style,
      params.keywords,
      params.suggestedVenue,
      params.flowerSuggestions,
      params.musicStyle,
      createdAt
    );
  }
}

export interface ThemePreferences {
  season: 'spring' | 'summer' | 'fall' | 'winter';
  formality: 'casual' | 'semi-formal' | 'formal' | 'black-tie';
  venueType?: string;
  colorPreference?: string;
  budget: 'budget-friendly' | 'moderate' | 'luxury';
  guestCount: number;
  personalStyle?: string;
  culturalElements?: string;
}