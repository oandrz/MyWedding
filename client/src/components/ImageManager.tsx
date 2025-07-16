import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Edit, Plus, Eye, EyeOff } from "lucide-react";
import type { ConfigImage } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

const imageConfigSchema = z.object({
  imageKey: z.string().min(1, "Image key is required"),
  imageUrl: z.string().url("Must be a valid URL"),
  imageType: z.enum(["banner", "gallery"]),
  title: z.string().optional(),
  description: z.string().optional(),
  isActive: z.boolean().default(true)
});

type ImageConfigForm = z.infer<typeof imageConfigSchema>;

const ImageManager = () => {
  const [activeTab, setActiveTab] = useState("banner");
  const [editingImage, setEditingImage] = useState<ConfigImage | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all configurable images
  const { data: imagesData, isLoading } = useQuery<{ images: ConfigImage[] }>({
    queryKey: ["/api/config-images"],
  });

  // Filter images by type
  const bannerImages = imagesData?.images?.filter(img => img.imageType === "banner") || [];
  const galleryImages = imagesData?.images?.filter(img => img.imageType === "gallery") || [];

  // Form setup
  const form = useForm<ImageConfigForm>({
    resolver: zodResolver(imageConfigSchema),
    defaultValues: {
      imageKey: "",
      imageUrl: "",
      imageType: activeTab as "banner" | "gallery",
      title: "",
      description: "",
      isActive: true
    }
  });

  // Create/Update mutation
  const updateImageMutation = useMutation({
    mutationFn: async (data: ImageConfigForm) => {
      if (editingImage) {
        return apiRequest(`/api/admin/config-images/${editingImage.imageKey}`, {
          method: "PUT",
          body: data
        });
      } else {
        return apiRequest("/api/admin/config-images", {
          method: "POST",
          body: data
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/config-images"] });
      queryClient.invalidateQueries({ queryKey: ["/api/config-images/banner"] });
      queryClient.invalidateQueries({ queryKey: ["/api/config-images/gallery"] });
      toast({
        title: "Success",
        description: editingImage ? "Image updated successfully!" : "Image created successfully!"
      });
      form.reset();
      setEditingImage(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save image",
        variant: "destructive"
      });
    }
  });

  const onSubmit = (data: ImageConfigForm) => {
    updateImageMutation.mutate(data);
  };

  const handleEdit = (image: ConfigImage) => {
    setEditingImage(image);
    form.reset({
      imageKey: image.imageKey,
      imageUrl: image.imageUrl,
      imageType: image.imageType as "banner" | "gallery",
      title: image.title || "",
      description: image.description || "",
      isActive: image.isActive ?? true
    });
  };

  const handleNewImage = (type: "banner" | "gallery") => {
    setEditingImage(null);
    form.reset({
      imageKey: type === "banner" ? "banner" : `gallery_custom_${Date.now()}`,
      imageUrl: "",
      imageType: type,
      title: "",
      description: "",
      isActive: true
    });
  };

  const ImageCard = ({ image }: { image: ConfigImage }) => (
    <Card className="overflow-hidden">
      <div className="relative h-48">
        <img 
          src={image.imageUrl} 
          alt={image.title || "Config image"}
          className="w-full h-full object-cover"
        />
        <div className="absolute top-2 right-2 flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => handleEdit(image)}
          >
            <Edit className="h-4 w-4" />
          </Button>
          {image.isActive ? (
            <Eye className="h-4 w-4 text-green-600" />
          ) : (
            <EyeOff className="h-4 w-4 text-gray-400" />
          )}
        </div>
      </div>
      <CardContent className="p-4">
        <h3 className="font-semibold text-sm">{image.title || image.imageKey}</h3>
        {image.description && (
          <p className="text-xs text-gray-600 mt-1">{image.description}</p>
        )}
        <p className="text-xs text-gray-500 mt-2">Key: {image.imageKey}</p>
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-64 bg-gray-200 animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Image Management</h2>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="banner">Banner Images</TabsTrigger>
          <TabsTrigger value="gallery">Gallery Images</TabsTrigger>
        </TabsList>

        <TabsContent value="banner" className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Banner Images</h3>
            <Button onClick={() => handleNewImage("banner")}>
              <Plus className="h-4 w-4 mr-2" />
              Add Banner Image
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {bannerImages.map((image) => (
              <ImageCard key={image.id} image={image} />
            ))}
            {bannerImages.length === 0 && (
              <div className="col-span-full text-center py-8 text-gray-500">
                No banner images configured. Add one to get started.
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="gallery" className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Gallery Images</h3>
            <Button onClick={() => handleNewImage("gallery")}>
              <Plus className="h-4 w-4 mr-2" />
              Add Gallery Image
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {galleryImages.map((image) => (
              <ImageCard key={image.id} image={image} />
            ))}
            {galleryImages.length === 0 && (
              <div className="col-span-full text-center py-8 text-gray-500">
                No gallery images configured. Default images will be used.
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Image Form */}
      <Card>
        <CardHeader>
          <CardTitle>
            {editingImage ? "Edit Image" : "Add New Image"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="imageKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Image Key</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="unique-image-key"
                        disabled={!!editingImage}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="imageUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Image URL</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="https://example.com/image.jpg"
                        type="url"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="imageType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Image Type</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value}
                      disabled={!!editingImage}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select image type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="banner">Banner</SelectItem>
                        <SelectItem value="gallery">Gallery</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title (Optional)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Image title" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Image description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex gap-2">
                <Button 
                  type="submit" 
                  disabled={updateImageMutation.isPending}
                >
                  {updateImageMutation.isPending 
                    ? "Saving..." 
                    : editingImage ? "Update Image" : "Add Image"
                  }
                </Button>
                
                {editingImage && (
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={() => {
                      setEditingImage(null);
                      form.reset();
                    }}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ImageManager;