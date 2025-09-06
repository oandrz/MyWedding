import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Palette, Flower, Music, MapPin, Sparkles, Calendar, Users, DollarSign } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';

interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
}

interface ThemeStyle {
  formality: string;
  atmosphere: string;
  decorStyle: string;
}

interface WeddingTheme {
  id: number;
  name: string;
  description: string;
  season: string;
  colors: ThemeColors;
  style: ThemeStyle;
  keywords: string[];
  suggestedVenue: string[];
  flowerSuggestions: string[];
  musicStyle: string[];
  matchScore?: number;
  createdAt: string;
}

export default function ThemeSuggester() {
  const { toast } = useToast();
  const [preferences, setPreferences] = useState({
    season: '',
    formality: '',
    venueType: '',
    colorPreference: '',
    budget: '',
    guestCount: 50,
    personalStyle: '',
    culturalElements: ''
  });

  const [generatedThemes, setGeneratedThemes] = useState<WeddingTheme[]>([]);

  // Fetch recent themes
  const { data: recentThemesData } = useQuery({
    queryKey: ['/api/themes/recent'],
    enabled: false // Only fetch when user explicitly requests it
  });

  // Generate themes mutation
  const generateThemesMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('/api/themes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences)
      });
      return response.themes;
    },
    onSuccess: (themes) => {
      setGeneratedThemes(themes);
      toast({
        title: 'Themes Generated!',
        description: `Created ${themes.length} personalized wedding themes for you`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Generation Failed',
        description: error.message || 'Failed to generate themes. Please try again.',
        variant: 'destructive'
      });
    }
  });

  const handleGenerateThemes = () => {
    if (!preferences.season || !preferences.formality || !preferences.budget || !preferences.guestCount) {
      toast({
        title: 'Missing Information',
        description: 'Please fill in all required fields',
        variant: 'destructive'
      });
      return;
    }
    generateThemesMutation.mutate();
  };

  const ColorPalette = ({ colors }: { colors: ThemeColors }) => (
    <div className="flex gap-2 items-center">
      <div 
        className="w-8 h-8 rounded-full border-2 border-gray-200" 
        style={{ backgroundColor: colors.primary }}
        title="Primary"
      />
      <div 
        className="w-8 h-8 rounded-full border-2 border-gray-200" 
        style={{ backgroundColor: colors.secondary }}
        title="Secondary"
      />
      <div 
        className="w-8 h-8 rounded-full border-2 border-gray-200" 
        style={{ backgroundColor: colors.accent }}
        title="Accent"
      />
      <div 
        className="w-8 h-8 rounded-full border-2 border-gray-200" 
        style={{ backgroundColor: colors.background }}
        title="Background"
      />
    </div>
  );

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-rose-500" />
            AI-Powered Wedding Theme Suggester
          </CardTitle>
          <CardDescription>
            Tell us about your dream wedding and our AI will create personalized theme suggestions just for you
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            {/* Season Selection */}
            <div className="space-y-2">
              <Label htmlFor="season" className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Season *
              </Label>
              <Select value={preferences.season} onValueChange={(value) => 
                setPreferences(prev => ({ ...prev, season: value }))
              }>
                <SelectTrigger>
                  <SelectValue placeholder="Select wedding season" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="spring">Spring</SelectItem>
                  <SelectItem value="summer">Summer</SelectItem>
                  <SelectItem value="fall">Fall</SelectItem>
                  <SelectItem value="winter">Winter</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Formality Level */}
            <div className="space-y-2">
              <Label htmlFor="formality">Formality Level *</Label>
              <Select value={preferences.formality} onValueChange={(value) => 
                setPreferences(prev => ({ ...prev, formality: value }))
              }>
                <SelectTrigger>
                  <SelectValue placeholder="Select formality" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="casual">Casual</SelectItem>
                  <SelectItem value="semi-formal">Semi-Formal</SelectItem>
                  <SelectItem value="formal">Formal</SelectItem>
                  <SelectItem value="black-tie">Black Tie</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Budget */}
            <div className="space-y-2">
              <Label htmlFor="budget" className="flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Budget Range *
              </Label>
              <Select value={preferences.budget} onValueChange={(value) => 
                setPreferences(prev => ({ ...prev, budget: value }))
              }>
                <SelectTrigger>
                  <SelectValue placeholder="Select budget range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="budget-friendly">Budget Friendly</SelectItem>
                  <SelectItem value="moderate">Moderate</SelectItem>
                  <SelectItem value="luxury">Luxury</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Guest Count */}
            <div className="space-y-2">
              <Label htmlFor="guestCount" className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Expected Guests *
              </Label>
              <Input 
                type="number" 
                placeholder="Number of guests"
                value={preferences.guestCount}
                onChange={(e) => setPreferences(prev => ({ 
                  ...prev, 
                  guestCount: parseInt(e.target.value) || 50 
                }))}
                min={1}
                max={1000}
              />
            </div>

            {/* Venue Type */}
            <div className="space-y-2">
              <Label htmlFor="venueType" className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Venue Type
              </Label>
              <Input 
                placeholder="e.g., Beach, Garden, Ballroom"
                value={preferences.venueType}
                onChange={(e) => setPreferences(prev => ({ 
                  ...prev, 
                  venueType: e.target.value 
                }))}
              />
            </div>

            {/* Color Preference */}
            <div className="space-y-2">
              <Label htmlFor="colorPreference" className="flex items-center gap-2">
                <Palette className="w-4 h-4" />
                Color Preference
              </Label>
              <Input 
                placeholder="e.g., Blush, Navy, Gold"
                value={preferences.colorPreference}
                onChange={(e) => setPreferences(prev => ({ 
                  ...prev, 
                  colorPreference: e.target.value 
                }))}
              />
            </div>

            {/* Personal Style */}
            <div className="space-y-2">
              <Label htmlFor="personalStyle">Personal Style</Label>
              <Textarea 
                placeholder="Describe your style: Modern, Vintage, Bohemian, Classic..."
                value={preferences.personalStyle}
                onChange={(e) => setPreferences(prev => ({ 
                  ...prev, 
                  personalStyle: e.target.value 
                }))}
                rows={2}
              />
            </div>

            {/* Cultural Elements */}
            <div className="space-y-2">
              <Label htmlFor="culturalElements">Cultural Elements</Label>
              <Textarea 
                placeholder="Any cultural traditions or elements to include?"
                value={preferences.culturalElements}
                onChange={(e) => setPreferences(prev => ({ 
                  ...prev, 
                  culturalElements: e.target.value 
                }))}
                rows={2}
              />
            </div>
          </div>

          <Button 
            onClick={handleGenerateThemes}
            disabled={generateThemesMutation.isPending}
            className="w-full mt-6 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600"
          >
            {generateThemesMutation.isPending ? (
              <>Generating Your Perfect Themes...</>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Wedding Themes
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Generated Themes */}
      {generatedThemes.length > 0 && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-center mb-4">Your Personalized Wedding Themes</h2>
          {generatedThemes.map((theme) => (
            <Card key={theme.id} className="overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-rose-50 to-pink-50">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-xl">{theme.name}</CardTitle>
                    <CardDescription className="mt-2">{theme.description}</CardDescription>
                  </div>
                  {theme.matchScore && (
                    <Badge className="bg-rose-100 text-rose-700">
                      {theme.matchScore}% Match
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Color Palette */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Palette className="w-4 h-4" />
                      Color Palette
                    </Label>
                    <ColorPalette colors={theme.colors} />
                  </div>

                  {/* Style Info */}
                  <div className="space-y-2">
                    <Label>Style & Atmosphere</Label>
                    <p className="text-sm text-gray-600">
                      {theme.style.atmosphere}
                    </p>
                    <Badge variant="outline">{theme.style.formality}</Badge>
                  </div>

                  {/* Venue Suggestions */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      Suggested Venues
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {theme.suggestedVenue.map((venue, i) => (
                        <Badge key={i} variant="secondary">{venue}</Badge>
                      ))}
                    </div>
                  </div>

                  {/* Flowers */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Flower className="w-4 h-4" />
                      Flower Suggestions
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {theme.flowerSuggestions.map((flower, i) => (
                        <Badge key={i} variant="secondary">{flower}</Badge>
                      ))}
                    </div>
                  </div>

                  {/* Music */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Music className="w-4 h-4" />
                      Music Styles
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {theme.musicStyle.map((music, i) => (
                        <Badge key={i} variant="secondary">{music}</Badge>
                      ))}
                    </div>
                  </div>

                  {/* Keywords */}
                  <div className="space-y-2">
                    <Label>Theme Keywords</Label>
                    <div className="flex flex-wrap gap-2">
                      {theme.keywords.map((keyword, i) => (
                        <Badge key={i} variant="outline">{keyword}</Badge>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Decoration Style */}
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <Label className="mb-2 block">Decoration Style</Label>
                  <p className="text-sm text-gray-600">{theme.style.decorStyle}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}