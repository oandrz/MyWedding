import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Check, Palette, Heart } from 'lucide-react';
import { weddingTemplates, type WeddingTemplate } from '@shared/templates';
import { apiRequest } from '@/lib/queryClient';

const Templates: React.FC = () => {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch current active template
  const { data: activeTemplate } = useQuery({
    queryKey: ['/api/templates/active'],
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Mutation to activate a template
  const activateTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const response = await fetch('/api/templates/activate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ templateId }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to activate template');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/templates'] });
      toast({
        title: '✨ Template Applied!',
        description: `Your wedding invitation now uses the ${data.template.name} theme.`,
      });
      
      // Apply the template immediately to the page
      applyTemplateStyles(data.template);
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to apply template. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const applyTemplateStyles = (template: any) => {
    const root = document.documentElement;
    const colors = JSON.parse(template.colorScheme);
    
    // Apply CSS variables
    Object.entries(colors).forEach(([key, value]) => {
      root.style.setProperty(`--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`, value as string);
    });
  };

  const handleSelectTemplate = (template: WeddingTemplate) => {
    setSelectedTemplate(template.id);
    activateTemplateMutation.mutate(template.id);
  };

  const PreviewCard = ({ template }: { template: WeddingTemplate }) => {
    const isActive = activeTemplate && 'name' in activeTemplate ? activeTemplate.name === template.name : false;
    const isSelected = selectedTemplate === template.id;
    
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <Card 
          className={`cursor-pointer transition-all duration-200 ${
            isActive ? 'ring-2 ring-rose-500 shadow-lg' : 'hover:shadow-md'
          } ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
          onClick={() => handleSelectTemplate(template)}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Palette className="h-5 w-5" />
                {template.name}
              </CardTitle>
              {isActive && (
                <Badge className="bg-rose-500 text-white gap-1">
                  <Check className="h-3 w-3" />
                  Active
                </Badge>
              )}
            </div>
            <CardDescription>{template.description}</CardDescription>
          </CardHeader>
          
          <CardContent>
            {/* Color Palette Preview */}
            <div className="mb-4">
              <p className="text-sm font-medium mb-2">Color Palette</p>
              <div className="flex gap-2">
                <div 
                  className="w-8 h-8 rounded-full border-2 border-white shadow-sm"
                  style={{ backgroundColor: template.preview.primary }}
                  title="Primary Color"
                />
                <div 
                  className="w-8 h-8 rounded-full border-2 border-white shadow-sm"
                  style={{ backgroundColor: template.preview.secondary }}
                  title="Secondary Color"
                />
                <div 
                  className="w-8 h-8 rounded-full border-2 border-white shadow-sm"
                  style={{ backgroundColor: template.preview.background }}
                  title="Background Color"
                />
              </div>
            </div>

            {/* Font Preview */}
            <div className="mb-4">
              <p className="text-sm font-medium mb-2">Typography</p>
              <p 
                className="text-lg"
                style={{ fontFamily: template.fontFamily }}
              >
                Sarah & John
              </p>
              <p className="text-sm text-gray-600">{template.fontFamily}</p>
            </div>

            {/* Mini Preview */}
            <div 
              className="p-4 rounded-lg border"
              style={{ 
                backgroundColor: template.preview.background,
                borderColor: template.preview.primary + '40'
              }}
            >
              <div className="text-center">
                <Heart 
                  className="h-6 w-6 mx-auto mb-2"
                  style={{ color: template.preview.primary }}
                />
                <h4 
                  className="font-semibold text-sm mb-1"
                  style={{ 
                    color: template.preview.primary,
                    fontFamily: template.fontFamily 
                  }}
                >
                  Wedding Invitation
                </h4>
                <p className="text-xs opacity-75">Preview</p>
              </div>
            </div>

            {/* Select Button */}
            <Button
              className="w-full mt-4"
              variant={isActive ? "secondary" : "default"}
              disabled={activateTemplateMutation.isPending || isActive}
              style={{
                backgroundColor: !isActive ? template.preview.primary : undefined,
                borderColor: template.preview.primary
              }}
            >
              {activateTemplateMutation.isPending && selectedTemplate === template.id ? (
                'Applying...'
              ) : isActive ? (
                'Currently Active'
              ) : (
                'Use This Template'
              )}
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Choose Your Wedding Theme
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Select from our beautiful collection of wedding invitation themes. 
            Each template includes unique colors, typography, and styling that will 
            transform your entire invitation experience.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          <AnimatePresence>
            {weddingTemplates.map((template) => (
              <PreviewCard key={template.id} template={template} />
            ))}
          </AnimatePresence>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-12 text-center"
        >
          <Card className="max-w-2xl mx-auto">
            <CardContent className="pt-6">
              <Heart className="h-8 w-8 text-rose-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">
                Template Applied Successfully!
              </h3>
              <p className="text-gray-600 mb-4">
                Your wedding invitation theme has been updated. The new colors and styling 
                will be applied throughout your entire invitation experience.
              </p>
              <Button 
                onClick={() => window.location.href = '/'}
                className="bg-rose-500 hover:bg-rose-600"
              >
                View Your Wedding Invitation
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default Templates;