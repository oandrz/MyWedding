import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Upload, Link, X, FileImage, Loader2, Info, AlertTriangle, CheckCircle, Settings } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

const urlImageSchema = z.object({
  imageUrl: z.string().url("Must be a valid URL"),
  title: z.string().optional(),
  description: z.string().optional(),
});

const fileUploadSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  file: z.any().refine((file) => file instanceof File || file === undefined, "Please select a file"),
});

type UrlImageForm = z.infer<typeof urlImageSchema>;
type FileUploadForm = z.infer<typeof fileUploadSchema>;

interface ImageUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageType: "banner" | "gallery" | "bride-profile" | "groom-profile";
  editingImage?: any; // ConfigImage type
  onSuccess?: () => void;
}

// Image processing state and types
interface ImageAnalysis {
  width: number;
  height: number;
  aspectRatio: number;
  fileSize: number;
  recommendedRatio: number;
  isOptimalSize: boolean;
  isOptimalRatio: boolean;
  needsCompression: boolean;
}

interface ProcessedImage {
  file: File;
  analysis: ImageAnalysis;
  optimized?: boolean;
}

const ImageUploadModal = ({ isOpen, onClose, imageType, editingImage, onSuccess }: ImageUploadModalProps) => {
  const [activeTab, setActiveTab] = useState("upload");
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [processedImage, setProcessedImage] = useState<ProcessedImage | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get optimization targets based on image type
  const getOptimizationTargets = () => {
    if (imageType === "banner") {
      return {
        maxFileSize: 200 * 1024, // 200KB
        recommendedRatio: 16/9,
        optimalDimensions: [
          { width: 1920, height: 1080 },
          { width: 1600, height: 900 },
          { width: 1280, height: 720 }
        ]
      };
    } else if (imageType === "bride-profile" || imageType === "groom-profile") {
      return {
        maxFileSize: 120 * 1024, // 120KB (smaller for profile pics)
        recommendedRatio: 1, // Square 1:1 for circular display
        optimalDimensions: [
          { width: 500, height: 500 },
          { width: 600, height: 600 },
          { width: 800, height: 800 }
        ]
      };
    } else {
      return {
        maxFileSize: 150 * 1024, // 150KB  
        recommendedRatio: 1, // Square 1:1
        optimalDimensions: [
          { width: 1080, height: 1080 },
          { width: 1080, height: 1350 },
          { width: 1350, height: 1080 }
        ]
      };
    }
  };

  // Analyze image dimensions and properties
  const analyzeImage = (file: File): Promise<ImageAnalysis> => {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      
      img.onload = () => {
        URL.revokeObjectURL(url);
        
        const targets = getOptimizationTargets();
        const aspectRatio = img.width / img.height;
        const ratioTolerance = 0.1;
        
        const analysis: ImageAnalysis = {
          width: img.width,
          height: img.height,
          aspectRatio,
          fileSize: file.size,
          recommendedRatio: targets.recommendedRatio,
          isOptimalSize: file.size <= targets.maxFileSize,
          isOptimalRatio: Math.abs(aspectRatio - targets.recommendedRatio) <= ratioTolerance,
          needsCompression: file.size > targets.maxFileSize
        };
        
        resolve(analysis);
      };
      
      img.src = url;
    });
  };

  // Compress image using canvas
  const compressImage = (file: File, targetSizeKB: number, quality: number = 0.8): Promise<File> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      const img = new Image();
      const url = URL.createObjectURL(file);
      
      img.onload = () => {
        URL.revokeObjectURL(url);
        
        // Set canvas dimensions
        canvas.width = img.width;
        canvas.height = img.height;
        
        // Draw image on canvas
        ctx.drawImage(img, 0, 0);
        
        // Convert to blob with compression
        canvas.toBlob((blob) => {
          if (blob) {
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg', // Convert to JPEG for better compression
              lastModified: Date.now()
            });
            resolve(compressedFile);
          } else {
            resolve(file); // Fallback to original
          }
        }, 'image/jpeg', quality);
      };
      
      img.src = url;
    });
  };

  // Auto-optimize image based on guidelines
  const optimizeImage = async (file: File): Promise<ProcessedImage> => {
    setIsProcessing(true);
    
    try {
      const analysis = await analyzeImage(file);
      let optimizedFile = file;
      let optimized = false;
      
      // Compress if needed
      if (analysis.needsCompression) {
        const targets = getOptimizationTargets();
        const targetSizeKB = targets.maxFileSize / 1024;
        
        // Try different quality levels
        let quality = 0.8;
        for (let attempt = 0; attempt < 3; attempt++) {
          optimizedFile = await compressImage(file, targetSizeKB, quality);
          if (optimizedFile.size <= targets.maxFileSize) break;
          quality -= 0.2;
        }
        
        optimized = optimizedFile.size < file.size;
      }
      
      const finalAnalysis = optimizedFile !== file ? await analyzeImage(optimizedFile) : analysis;
      
      return {
        file: optimizedFile,
        analysis: finalAnalysis,
        optimized
      };
    } finally {
      setIsProcessing(false);
    }
  };

  // URL form
  const urlForm = useForm<UrlImageForm>({
    resolver: zodResolver(urlImageSchema),
    defaultValues: {
      imageUrl: editingImage?.imageUrl || "",
      title: editingImage?.title || "",
      description: editingImage?.description || "",
    }
  });

  // File upload form
  const fileForm = useForm<FileUploadForm>({
    resolver: zodResolver(fileUploadSchema),
    defaultValues: {
      title: editingImage?.title || "",
      description: editingImage?.description || "",
      file: undefined,
    }
  });

  // URL submission mutation
  const urlMutation = useMutation({
    mutationFn: async (data: UrlImageForm) => {
      if (editingImage) {
        // Update existing image
        return apiRequest("PUT", `/api/admin/config-images/${editingImage.imageKey}`, {
          ...data,
          imageKey: editingImage.imageKey,
          imageType,
          isActive: true
        });
      } else {
        // Create new image
        const imageKey = imageType === "banner" ? "banner" : `gallery_${Date.now()}`;
        return apiRequest("POST", "/api/admin/config-images", {
          ...data,
          imageKey,
          imageType,
          isActive: true
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
      const formData = new FormData();
      formData.append("file", data.file);
      
      // Generate a unique image key for this upload
      const timestamp = Date.now();
      const imageKey = editingImage?.imageKey || (imageType === "banner" ? "banner" : `gallery_${timestamp}`);
      
      formData.append("imageKey", imageKey);
      formData.append("imageType", imageType);
      formData.append("title", data.title || "");
      formData.append("description", data.description || "");

      // Use the new config images upload endpoint with admin key authentication
      const adminKey = localStorage.getItem('adminKey');
      const uploadUrl = adminKey 
        ? `/api/admin/config-images-upload?adminKey=${adminKey}`
        : `/api/admin/config-images-upload`;
        
      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        body: formData
      });
      
      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json();
        throw new Error(errorData.message || "Failed to upload config image");
      }
      
      return uploadResponse.json();
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
      setProcessedImage(processed);
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
    setProcessedImage(null);
    setActiveTab("upload");
    onClose();
  };

  // Helper function to format file size
  const formatFileSize = (bytes: number) => {
    const kb = bytes / 1024;
    return kb > 1024 ? `${(kb / 1024).toFixed(1)}MB` : `${Math.round(kb)}KB`;
  };

  // Helper function to format dimensions
  const formatDimensions = (width: number, height: number) => {
    return `${width} × ${height}px`;
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
                          <div className="mt-3 p-3 bg-white rounded border text-left">
                            <div className="grid grid-cols-2 gap-3 text-xs">
                              <div>
                                <span className="font-medium">Dimensions:</span>
                                <div className={processedImage.analysis.isOptimalRatio ? "text-green-600" : "text-orange-600"}>
                                  {formatDimensions(processedImage.analysis.width, processedImage.analysis.height)}
                                  {processedImage.analysis.isOptimalRatio ? " ✓" : " ⚠"}
                                </div>
                              </div>
                              <div>
                                <span className="font-medium">File Size:</span>
                                <div className={processedImage.analysis.isOptimalSize ? "text-green-600" : "text-orange-600"}>
                                  {formatFileSize(processedImage.analysis.fileSize)}
                                  {processedImage.analysis.isOptimalSize ? " ✓" : " ⚠"}
                                </div>
                              </div>
                              <div>
                                <span className="font-medium">Aspect Ratio:</span>
                                <div className={processedImage.analysis.isOptimalRatio ? "text-green-600" : "text-orange-600"}>
                                  {processedImage.analysis.aspectRatio.toFixed(2)}:1
                                  {imageType === "banner" && !processedImage.analysis.isOptimalRatio && " (16:9 recommended)"}
                                  {imageType === "gallery" && !processedImage.analysis.isOptimalRatio && " (1:1 recommended)"}
                                </div>
                              </div>
                              <div>
                                <span className="font-medium">Format:</span>
                                <div className="text-green-600">
                                  {processedImage.optimized ? "JPEG (optimized)" : processedImage.file.type.split('/')[1].toUpperCase()}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setUploadedFile(null);
                            setProcessedImage(null);
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

                <FormField
                  control={fileForm.control}
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
                  control={fileForm.control}
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

                <FormField
                  control={urlForm.control}
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
                  control={urlForm.control}
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