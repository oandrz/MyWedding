import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useImageAnalysis } from "@/hooks/useImageAnalysis";
import { ImagePreview } from "@/components/ImagePreview";
import { Upload, Link, X, Loader2, Info, AlertTriangle, CheckCircle, Settings } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

const urlImageSchema = z.object({
  imageUrl: z.string().url("Must be a valid URL"),
});

const fileUploadSchema = z.object({
  file: z.any().refine((file) => file instanceof File || file === undefined, "Please select a file"),
});

type UrlImageForm = z.infer<typeof urlImageSchema>;
type FileUploadForm = z.infer<typeof fileUploadSchema>;

interface ImageUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageType: "banner" | "gallery" | "bride-profile" | "groom-profile" | "verse-image";
  editingImage?: any; // ConfigImage type
  onSuccess?: () => void;
}

const ImageUploadModal = ({ isOpen, onClose, imageType, editingImage, onSuccess }: ImageUploadModalProps) => {
  const [activeTab, setActiveTab] = useState("upload");
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { processedImage, isProcessing, optimizeImage, clearProcessedImage } = useImageAnalysis(imageType);

  // URL form
  const urlForm = useForm<UrlImageForm>({
    resolver: zodResolver(urlImageSchema),
    defaultValues: {
      imageUrl: editingImage?.imageUrl || "",
    }
  });

  // File upload form
  const fileForm = useForm<FileUploadForm>({
    resolver: zodResolver(fileUploadSchema),
    defaultValues: {
      file: undefined,
    }
  });

  // URL submission mutation
  const urlMutation = useMutation({
    mutationFn: async (data: UrlImageForm) => {
      if (editingImage) {
        // Update existing image
        return apiRequest("PUT", `/api/admin/config-images/${editingImage.imageKey}`, {
          imageUrl: data.imageUrl,
          imageKey: editingImage.imageKey,
          imageType,
          isActive: true,
          title: editingImage.title ?? "",
          description: editingImage.description ?? "",
        });
      } else {
        // Create new image
        const imageKey = imageType === "banner" ? "banner" : `gallery_${Date.now()}`;
        return apiRequest("POST", "/api/admin/config-images", {
          imageUrl: data.imageUrl,
          imageKey,
          imageType,
          isActive: true,
          title: "",
          description: "",
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/config-images"] });
      queryClient.invalidateQueries({ queryKey: [`/api/config-images/${imageType}`] });
      toast({
        title: "Success",
        description: "Image added successfully!"
      });
      urlForm.reset();
      onSuccess?.();
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add image",
        variant: "destructive"
      });
    }
  });

  // File upload mutation for config images - now uses App Storage directly
  const fileMutation = useMutation({
    mutationFn: async (data: FileUploadForm) => {
      const file = data.file as File;
      const timestamp = Date.now();
      const imageKey = editingImage?.imageKey || (imageType === "banner" ? "banner" : `gallery_${timestamp}`);

      // Step 1 — get a signed upload URL from the Go backend (tiny JSON request, passes WAF)
      const ext = file.type === 'image/jpeg' ? 'jpg' : (file.type.split('/')[1] ?? 'jpg');
      const urlRes = await apiRequest('POST', '/api/admin/upload/signed-url', {
        imageKey,
        imageType,
        filename: `upload.${ext}`,
      });
      const body = await urlRes.json();
      const signedUrl: string = body.signedUrl;
      const storagePath: string = body.storagePath;
      if (!signedUrl || !storagePath) {
        throw new Error('Invalid signed URL response from server');
      }

      // Step 2 — PUT the binary directly to Supabase (bypasses CloudFront entirely)
      const uploadRes = await fetch(signedUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });
      if (!uploadRes.ok) {
        throw new Error(`Direct upload to storage failed with status ${uploadRes.status}`);
      }

      // Step 3 — notify Go to generate thumbnail and save the DB record
      const completeRes = await apiRequest('POST', '/api/admin/upload/complete', {
        storagePath,
        imageKey,
        imageType,
        title: editingImage?.title ?? '',
        description: editingImage?.description ?? '',
      });
      return completeRes.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/config-images"] });
      queryClient.invalidateQueries({ queryKey: [`/api/config-images/${imageType}`] });
      toast({
        title: "Success",
        description: "Image uploaded successfully!"
      });
      fileForm.reset();
      setUploadedFile(null);
      onSuccess?.();
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to upload image",
        variant: "destructive"
      });
    }
  });

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith("image/")) {
        await handleFileProcessing(file);
      } else {
        toast({
          title: "Invalid file type",
          description: "Please upload an image file",
          variant: "destructive"
        });
      }
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      await handleFileProcessing(file);
    }
  };

  const handleFileProcessing = async (file: File) => {
    try {
      setUploadedFile(file);
      const processed = await optimizeImage(file);
      fileForm.setValue("file", processed.file);

      // Show feedback to user
      if (processed.optimized) {
        const originalSizeKB = Math.round(file.size / 1024);
        const newSizeKB = Math.round(processed.file.size / 1024);
        toast({
          title: "Image Optimized!",
          description: `Compressed from ${originalSizeKB}KB to ${newSizeKB}KB`,
        });
      }
    } catch (error) {
      console.error("Error processing image:", error);
      toast({
        title: "Processing Error",
        description: "Failed to process image, using original",
        variant: "destructive"
      });
      // Fallback to original file
      setUploadedFile(file);
      fileForm.setValue("file", file);
    }
  };

  const onUrlSubmit = (data: UrlImageForm) => {
    urlMutation.mutate(data);
  };

  const onFileSubmit = (data: FileUploadForm) => {
    const fileToUpload = processedImage?.file || uploadedFile;
    if (!fileToUpload) {
      toast({
        title: "No file selected",
        description: "Please select an image file to upload",
        variant: "destructive"
      });
      return;
    }
    fileMutation.mutate({ ...data, file: fileToUpload });
  };

  const handleClose = () => {
    urlForm.reset();
    fileForm.reset();
    setUploadedFile(null);
    clearProcessedImage();
    setActiveTab("upload");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center">
              <Upload className="h-6 w-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl">
                {editingImage ? "Edit" : "Add"} {imageType === "banner" ? "Banner" : "Gallery"} Image
              </DialogTitle>
              <DialogDescription className="text-sm text-gray-500">
                {editingImage ? "Update the image details or replace the image" : "Upload a file or add an image URL"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload" className="gap-2">
              <Upload className="h-4 w-4" />
              Upload File
            </TabsTrigger>
            <TabsTrigger value="url" className="gap-2">
              <Link className="h-4 w-4" />
              Add URL
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-4">
            <Form {...fileForm}>
              <form onSubmit={fileForm.handleSubmit(onFileSubmit)} className="space-y-4">
                {/* Drag and Drop Area */}
                <div
                  className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    dragActive
                      ? "border-blue-400 bg-blue-50"
                      : uploadedFile
                      ? "border-green-400 bg-green-50"
                      : "border-gray-300 bg-gray-50"
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  {isProcessing ? (
                    <div className="space-y-3">
                      <Settings className="h-12 w-12 text-blue-600 mx-auto animate-spin" />
                      <div>
                        <p className="text-lg font-medium text-blue-800">Processing Image...</p>
                        <p className="text-sm text-blue-600">Optimizing size and format</p>
                      </div>
                    </div>
                  ) : uploadedFile ? (
                    <div className="space-y-3">
                      {processedImage?.analysis.isOptimalSize && processedImage?.analysis.isOptimalRatio ? (
                        <CheckCircle className="h-12 w-12 text-green-600 mx-auto" />
                      ) : (
                        <AlertTriangle className="h-12 w-12 text-orange-600 mx-auto" />
                      )}
                      <div>
                        <p className="text-lg font-medium text-green-800">
                          {processedImage?.optimized ? "Image Optimized!" : "File Ready"}
                        </p>
                        <p className="text-sm text-green-600">{uploadedFile.name}</p>

                        {/* Image Analysis Results */}
                        {processedImage && (
                          <ImagePreview processedImage={processedImage} imageType={imageType} />
                        )}

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setUploadedFile(null);
                            clearProcessedImage();
                            fileForm.setValue("file", undefined);
                          }}
                          className="mt-2"
                        >
                          <X className="h-4 w-4 mr-1" />
                          Remove
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <Upload className="h-12 w-12 text-blue-400 mx-auto" />
                      <div>
                        <p className="text-lg font-medium text-blue-600">Drag a file here</p>
                        <p className="text-sm text-gray-500">Or, if you prefer...</p>
                        <Button
                          type="button"
                          className="mt-3"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          Select a file from your computer
                        </Button>
                      </div>
                    </div>
                  )}

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>

                {/* Image Guidelines */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-blue-600" />
                    <h4 className="text-sm font-medium text-blue-800">
                      Recommended {imageType === "banner" ? "Banner" : "Gallery"} Image Guidelines
                    </h4>
                  </div>

                  {imageType === "banner" ? (
                    <div className="space-y-2 text-sm text-blue-700">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <span className="font-medium">Optimal Dimensions:</span>
                          <div className="text-xs mt-1">
                            • 1920 x 1080px (16:9 ratio)<br/>
                            • 1600 x 900px (alternative)<br/>
                            • 1280 x 720px (minimum)
                          </div>
                        </div>
                        <div>
                          <span className="font-medium">Best Practices:</span>
                          <div className="text-xs mt-1">
                            • Keep file under 200KB<br/>
                            • Use JPEG or WebP format<br/>
                            • Position subjects in upper half
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 text-sm text-blue-700">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <span className="font-medium">Optimal Dimensions:</span>
                          <div className="text-xs mt-1">
                            • 1080 x 1080px (square)<br/>
                            • 1080 x 1350px (portrait)<br/>
                            • 1350 x 1080px (landscape)
                          </div>
                        </div>
                        <div>
                          <span className="font-medium">Best Practices:</span>
                          <div className="text-xs mt-1">
                            • Keep file under 150KB<br/>
                            • Use JPEG or WebP format<br/>
                            • Square format works best
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    type="submit"
                    disabled={fileMutation.isPending || !uploadedFile}
                    className="flex-1"
                  >
                    {fileMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      "Upload Image"
                    )}
                  </Button>
                  <Button type="button" variant="outline" onClick={handleClose}>
                    Cancel
                  </Button>
                </div>
              </form>
            </Form>
          </TabsContent>

          <TabsContent value="url" className="space-y-4">
            <Form {...urlForm}>
              <form onSubmit={urlForm.handleSubmit(onUrlSubmit)} className="space-y-4">
                <FormField
                  control={urlForm.control}
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

                {/* Image Guidelines for URL Tab */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-blue-600" />
                    <h4 className="text-sm font-medium text-blue-800">
                      Recommended {imageType === "banner" ? "Banner" : "Gallery"} Image Guidelines
                    </h4>
                  </div>

                  {imageType === "banner" ? (
                    <div className="space-y-2 text-sm text-blue-700">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <span className="font-medium">Optimal Dimensions:</span>
                          <div className="text-xs mt-1">
                            • 1920 x 1080px (16:9 ratio)<br/>
                            • 1600 x 900px (alternative)<br/>
                            • 1280 x 720px (minimum)
                          </div>
                        </div>
                        <div>
                          <span className="font-medium">Best Practices:</span>
                          <div className="text-xs mt-1">
                            • Keep file under 200KB<br/>
                            • Use JPEG or WebP format<br/>
                            • Position subjects in upper half
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 text-sm text-blue-700">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <span className="font-medium">Optimal Dimensions:</span>
                          <div className="text-xs mt-1">
                            • 1080 x 1080px (square)<br/>
                            • 1080 x 1350px (portrait)<br/>
                            • 1350 x 1080px (landscape)
                          </div>
                        </div>
                        <div>
                          <span className="font-medium">Best Practices:</span>
                          <div className="text-xs mt-1">
                            • Keep file under 150KB<br/>
                            • Use JPEG or WebP format<br/>
                            • Square format works best
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    type="submit"
                    disabled={urlMutation.isPending}
                    className="flex-1"
                  >
                    {urlMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      "Add Image"
                    )}
                  </Button>
                  <Button type="button" variant="outline" onClick={handleClose}>
                    Cancel
                  </Button>
                </div>
              </form>
            </Form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default ImageUploadModal;
