import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import type { ConfigImage } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import ImageUploadModal from "./ImageUploadModal";
import { useDragAndDrop } from "@/hooks/useDragAndDrop";
import { SortableImageGrid, StaticImageGrid } from "./ImageGrid";

const imageConfigSchema = z.object({
  imageKey: z.string().min(1, "Image key is required"),
  imageUrl: z.string().url("Must be a valid URL"),
  imageType: z.enum(["banner", "gallery", "bride-profile", "groom-profile", "verse-image"]),
  title: z.string().optional(),
  description: z.string().optional(),
  isActive: z.boolean().default(true)
});

type ImageConfigForm = z.infer<typeof imageConfigSchema>;

const ImageManager = () => {
  const [activeTab, setActiveTab] = useState("banner");
  const [editingImage, setEditingImage] = useState<ConfigImage | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadModalType, setUploadModalType] = useState<"banner" | "gallery" | "bride-profile" | "groom-profile" | "verse-image">("banner");
  const [showDeleteDialog, setShowDeleteDialog] = useState<ConfigImage | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all configurable images - force fresh data
  const { data: imagesData, isLoading } = useQuery<{ images: ConfigImage[] }>({
    queryKey: ["/api/config-images"],
    staleTime: 0, // No cache - always fetch fresh data
    refetchOnWindowFocus: true,
  });

  // Filter images by type
  const bannerImages = imagesData?.images?.filter(img => img.imageType === "banner") || [];
  const galleryImages = imagesData?.images?.filter(img => img.imageType === "gallery") || [];
  const brideProfileImages = imagesData?.images?.filter(img => img.imageType === "bride-profile") || [];
  const groomProfileImages = imagesData?.images?.filter(img => img.imageType === "groom-profile") || [];
  const verseImages = imagesData?.images?.filter(img => img.imageType === "verse-image") || [];

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
        return apiRequest("PUT", `/api/admin/config-images/${editingImage.imageKey}`, data);
      } else {
        return apiRequest("POST", "/api/admin/config-images", data);
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

  const handleEdit = useCallback((image: ConfigImage) => {
    setUploadModalType(image.imageType as "banner" | "gallery" | "bride-profile" | "groom-profile" | "verse-image");
    setEditingImage(image);
    setShowUploadModal(true);
  }, []);

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (imageKey: string) => {
      return apiRequest("DELETE", `/api/admin/config-images/${imageKey}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/config-images"] });
      queryClient.invalidateQueries({ queryKey: ["/api/config-images/banner"] });
      queryClient.invalidateQueries({ queryKey: ["/api/config-images/gallery"] });
      toast({
        title: "Success",
        description: "Image deleted successfully!"
      });
      setShowDeleteDialog(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete image",
        variant: "destructive"
      });
    }
  });

  const reorderMutation = useMutation({
    mutationFn: async (orderedKeys: string[]) => {
      return apiRequest("PUT", "/api/admin/config-images-reorder", {
        imageType: "gallery",
        orderedKeys,
      });
    },
    onMutate: async (orderedKeys: string[]) => {
      await queryClient.cancelQueries({ queryKey: ["/api/config-images"] });

      const previousData = queryClient.getQueryData<{ images: ConfigImage[] }>(["/api/config-images"]);

      if (previousData) {
        const imageMap = new Map(
          previousData.images.map((img) => [img.imageKey, img])
        );
        const reorderedGallery = orderedKeys
          .map((key, index) => {
            const img = imageMap.get(key);
            if (!img) return null;
            return { ...img, displayOrder: index };
          })
          .filter(Boolean) as ConfigImage[];
        const nonGallery = previousData.images.filter(
          (img) => img.imageType !== "gallery"
        );
        queryClient.setQueryData(["/api/config-images"], {
          images: [...nonGallery, ...reorderedGallery],
        });
      }

      return { previousData };
    },
    onError: (error: any, _orderedKeys, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(["/api/config-images"], context.previousData);
      }
      toast({
        title: "Error",
        description: error.message || "Failed to reorder gallery",
        variant: "destructive",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/config-images"] });
      queryClient.invalidateQueries({ queryKey: ["/api/config-images/gallery"] });
    },
  });

  const getImageKey = useCallback((img: ConfigImage) => img.imageKey, []);

  const handleReorder = useCallback(
    (orderedKeys: string[]) => reorderMutation.mutate(orderedKeys),
    [reorderMutation],
  );

  const {
    sensors,
    collisionDetection,
    activeDragItem: activeDragImage,
    isDragActive,
    itemIds: galleryItemIds,
    handleDragStart,
    handleDragEnd,
  } = useDragAndDrop({
    items: galleryImages,
    getId: getImageKey,
    onReorder: handleReorder,
  });

  const handleDeleteClick = useCallback((image: ConfigImage) => {
    setShowDeleteDialog(image);
  }, []);

  const handleNewImage = (type: "banner" | "gallery" | "bride-profile" | "groom-profile" | "verse-image") => {
    setEditingImage(null); // Clear editing state for new image
    setUploadModalType(type);
    setShowUploadModal(true);
  };

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
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="banner">Banner</TabsTrigger>
          <TabsTrigger value="gallery">Gallery</TabsTrigger>
          <TabsTrigger value="bride-profile">Bride</TabsTrigger>
          <TabsTrigger value="groom-profile">Groom</TabsTrigger>
          <TabsTrigger value="verse-image">Verse</TabsTrigger>
        </TabsList>

        <TabsContent value="banner" className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold">Banner Images</h3>
              <p className="text-sm text-gray-600">Hero section background image</p>
            </div>
          </div>

          <StaticImageGrid
            images={bannerImages}
            onEdit={handleEdit}
            emptyLabel="Add Banner Image"
            emptyColorScheme="rose"
            onAdd={() => handleNewImage("banner")}
          />
        </TabsContent>

        <TabsContent value="gallery" className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold">Gallery Images</h3>
              <p className="text-sm text-gray-600">
                Images showcased in the gallery section — drag the grip icon to reorder
              </p>
            </div>
          </div>

          <SortableImageGrid
            images={galleryImages}
            itemIds={galleryItemIds}
            sensors={sensors}
            collisionDetection={collisionDetection}
            isDragActive={isDragActive}
            activeDragImage={activeDragImage}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onEdit={handleEdit}
            onDelete={handleDeleteClick}
            onAdd={() => handleNewImage("gallery")}
          />
        </TabsContent>

        <TabsContent value="bride-profile" className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold">Bride Profile Image</h3>
              <p className="text-sm text-gray-600">Profile photo displayed in the "Our Love Story" section</p>
            </div>
          </div>

          <StaticImageGrid
            images={brideProfileImages}
            onEdit={handleEdit}
            onDelete={handleDeleteClick}
            emptyLabel="Add Bride Photo"
            emptyColorScheme="purple"
            onAdd={() => handleNewImage("bride-profile")}
          />
        </TabsContent>

        <TabsContent value="groom-profile" className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold">Groom Profile Image</h3>
              <p className="text-sm text-gray-600">Profile photo displayed in the "Our Love Story" section</p>
            </div>
          </div>

          <StaticImageGrid
            images={groomProfileImages}
            onEdit={handleEdit}
            onDelete={handleDeleteClick}
            emptyLabel="Add Groom Photo"
            emptyColorScheme="blue"
            onAdd={() => handleNewImage("groom-profile")}
          />
        </TabsContent>

        <TabsContent value="verse-image" className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold">Verse Section Image</h3>
              <p className="text-sm text-gray-600">Image displayed next to the Bible verse</p>
            </div>
          </div>

          <StaticImageGrid
            images={verseImages}
            onEdit={handleEdit}
            onDelete={handleDeleteClick}
            emptyLabel="Add Verse Image"
            emptyColorScheme="amber"
            onAdd={() => handleNewImage("verse-image")}
          />
        </TabsContent>
      </Tabs>

      {/* Upload Modal */}
      <ImageUploadModal
        isOpen={showUploadModal}
        onClose={() => {
          setShowUploadModal(false);
          setEditingImage(null);
        }}
        imageType={uploadModalType}
        editingImage={editingImage}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/config-images"] });
          queryClient.invalidateQueries({ queryKey: ["/api/config-images/banner"] });
          queryClient.invalidateQueries({ queryKey: ["/api/config-images/gallery"] });
          queryClient.invalidateQueries({ queryKey: ["/api/config-images/bride-profile"] });
          queryClient.invalidateQueries({ queryKey: ["/api/config-images/groom-profile"] });
          queryClient.invalidateQueries({ queryKey: ["/api/config-images/verse-image"] });
        }}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!showDeleteDialog} onOpenChange={() => setShowDeleteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Image</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this image? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => showDeleteDialog && deleteMutation.mutate(showDeleteDialog.imageKey)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Legacy form - hide this for now */}
      {false && editingImage && (
        <Card>
          <CardHeader>
            <CardTitle>Edit Image</CardTitle>
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
                    {updateImageMutation.isPending ? "Saving..." : "Update Image"}
                  </Button>

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
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

    </div>
  );
};

export default ImageManager;
