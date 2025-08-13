export interface WeddingTemplate {
  id: string;
  name: string;
  description: string;
  fontFamily: string;
  colors: {
    background: string;
    foreground: string;
    primary: string;
    primaryForeground: string;
    secondary: string;
    secondaryForeground: string;
    accent: string;
    accentForeground: string;
    muted: string;
    mutedForeground: string;
    border: string;
    ring: string;
  };
  preview: {
    primary: string;
    secondary: string;
    background: string;
  };
}

export const weddingTemplates: WeddingTemplate[] = [
  {
    id: 'classic-rose',
    name: 'Classic Rose',
    description: 'Romantic pink and rose tones with elegant typography',
    fontFamily: 'Inter',
    colors: {
      background: '30 33% 97%',
      foreground: '20 10% 29%',
      primary: '0 41% 76%',
      primaryForeground: '0 0% 100%',
      secondary: '142 13% 75%',
      secondaryForeground: '0 0% 100%',
      accent: '45 70% 52%',
      accentForeground: '0 0% 100%',
      muted: '30 4% 90%',
      mutedForeground: '20 10% 40%',
      border: '30 10% 85%',
      ring: '35 91% 65%'
    },
    preview: {
      primary: '#e879a7',
      secondary: '#9db39a',
      background: '#fef8f5'
    }
  },
  {
    id: 'elegant-navy',
    name: 'Elegant Navy',
    description: 'Sophisticated navy blue with gold accents',
    fontFamily: 'Playfair Display',
    colors: {
      background: '220 27% 98%',
      foreground: '220 84% 17%',
      primary: '220 84% 17%',
      primaryForeground: '0 0% 100%',
      secondary: '45 93% 47%',
      secondaryForeground: '220 84% 17%',
      accent: '45 93% 47%',
      accentForeground: '220 84% 17%',
      muted: '220 14% 96%',
      mutedForeground: '220 84% 46%',
      border: '220 13% 91%',
      ring: '45 93% 47%'
    },
    preview: {
      primary: '#1e3a8a',
      secondary: '#f59e0b',
      background: '#f8fafc'
    }
  },
  {
    id: 'romantic-lavender',
    name: 'Romantic Lavender',
    description: 'Soft lavender hues with cream and sage accents',
    fontFamily: 'Inter',
    colors: {
      background: '270 20% 98%',
      foreground: '270 15% 25%',
      primary: '270 50% 70%',
      primaryForeground: '0 0% 100%',
      secondary: '90 25% 80%',
      secondaryForeground: '270 15% 25%',
      accent: '50 30% 85%',
      accentForeground: '270 15% 25%',
      muted: '270 20% 94%',
      mutedForeground: '270 15% 40%',
      border: '270 20% 90%',
      ring: '270 50% 70%'
    },
    preview: {
      primary: '#a78bfa',
      secondary: '#c7d2cc',
      background: '#fdfbff'
    }
  },
  {
    id: 'vintage-gold',
    name: 'Vintage Gold',
    description: 'Warm gold tones with antique cream backgrounds',
    fontFamily: 'Crimson Text',
    colors: {
      background: '45 44% 96%',
      foreground: '25 25% 20%',
      primary: '45 93% 47%',
      primaryForeground: '25 25% 20%',
      secondary: '25 30% 85%',
      secondaryForeground: '25 25% 20%',
      accent: '25 30% 75%',
      accentForeground: '25 25% 20%',
      muted: '45 20% 92%',
      mutedForeground: '25 25% 40%',
      border: '45 20% 88%',
      ring: '45 93% 47%'
    },
    preview: {
      primary: '#f59e0b',
      secondary: '#e7d4b7',
      background: '#fefbf3'
    }
  },
  {
    id: 'modern-sage',
    name: 'Modern Sage',
    description: 'Contemporary sage green with clean minimalist design',
    fontFamily: 'Inter',
    colors: {
      background: '120 20% 98%',
      foreground: '120 15% 20%',
      primary: '142 35% 55%',
      primaryForeground: '0 0% 100%',
      secondary: '120 15% 85%',
      secondaryForeground: '120 15% 20%',
      accent: '60 30% 80%',
      accentForeground: '120 15% 20%',
      muted: '120 20% 94%',
      mutedForeground: '120 15% 40%',
      border: '120 20% 90%',
      ring: '142 35% 55%'
    },
    preview: {
      primary: '#6aa071',
      secondary: '#d8ddd4',
      background: '#fdfffe'
    }
  },
  {
    id: 'rustic-burgundy',
    name: 'Rustic Burgundy',
    description: 'Rich burgundy with warm earth tones and rustic charm',
    fontFamily: 'Merriweather',
    colors: {
      background: '15 25% 96%',
      foreground: '15 30% 20%',
      primary: '0 50% 40%',
      primaryForeground: '0 0% 100%',
      secondary: '25 40% 75%',
      secondaryForeground: '15 30% 20%',
      accent: '35 45% 70%',
      accentForeground: '15 30% 20%',
      muted: '15 20% 92%',
      mutedForeground: '15 30% 40%',
      border: '15 20% 88%',
      ring: '0 50% 40%'
    },
    preview: {
      primary: '#991b1b',
      secondary: '#d4a574',
      background: '#fef7f0'
    }
  }
];

export const getTemplateById = (id: string): WeddingTemplate | undefined => {
  return weddingTemplates.find(template => template.id === id);
};

export const getDefaultTemplate = (): WeddingTemplate => {
  return weddingTemplates[0]; // Classic Rose as default
};

// Helper function to apply template styles to document
export const applyTemplateStyles = (template: WeddingTemplate) => {
  const root = document.documentElement;
  
  // Apply CSS variables for colors
  Object.entries(template.colors).forEach(([key, value]) => {
    const cssVarName = `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
    root.style.setProperty(cssVarName, value);
  });
  
  // Apply font family
  root.style.setProperty('--font-family-main', template.fontFamily);
};

// Load active template on app initialization
export const loadActiveTemplate = async () => {
  try {
    const response = await fetch('/api/templates/active');
    if (response.ok) {
      const template = await response.json();
      
      // Find matching predefined template to get full styles
      const fullTemplate = getTemplateById(template.name?.toLowerCase().replace(/\s+/g, '-')) || getDefaultTemplate();
      applyTemplateStyles(fullTemplate);
      
      return fullTemplate;
    }
  } catch (error) {
    console.warn('Failed to load active template, using default:', error);
  }
  
  // Fallback to default template
  const defaultTemplate = getDefaultTemplate();
  applyTemplateStyles(defaultTemplate);
  return defaultTemplate;
};