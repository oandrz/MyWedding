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
import { Upload, Link, X, FileImage, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

const urlImageSchema = z.object({
  imageUrl: z.string().url("Must be a valid URL"),
  title: z.string().optional(),
  description: z.string().optional(),
});

const fileUploadSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  file: z.any().refine((file) => file instanceof File, "Please select a file"),
});

type UrlImageForm = z.infer<typeof urlImageSchema>;
type FileUploadForm = z.infer<typeof fileUploadSchema>;

interface ImageUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageType: "banner" | "gallery";
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
      file: null,
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
      console.log('Upload Debug - adminKey exists:', !!adminKey);
      const uploadUrl = adminKey 
        ? `/api/admin/config-images-upload?adminKey=${adminKey}`
        : `/api/admin/config-images-upload`;
      console.log('Upload Debug - URL:', uploadUrl);
        
      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        body: formData
      });
      
      console.log('Upload Debug - Response status:', uploadResponse.status);
      
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

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith("image/")) {
        setUploadedFile(file);
        fileForm.setValue("file", file);
      } else {
        toast({
          title: "Invalid file type",
          description: "Please upload an image file",
          variant: "destructive"
        });
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setUploadedFile(file);
      fileForm.setValue("file", file);
    }
  };

  const onUrlSubmit = (data: UrlImageForm) => {
    urlMutation.mutate(data);
  };

  const onFileSubmit = (data: FileUploadForm) => {
    if (!uploadedFile) {
      toast({
        title: "No file selected",
        description: "Please select an image file to upload",
        variant: "destructive"
      });
      return;
    }
    fileMutation.mutate({ ...data, file: uploadedFile });
  };

  const handleClose = () => {
    urlForm.reset();
    fileForm.reset();
    setUploadedFile(null);
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
                  {uploadedFile ? (
                    <div className="space-y-3">
                      <FileImage className="h-12 w-12 text-green-600 mx-auto" />
                      <div>
                        <p className="text-lg font-medium text-green-800">File Ready</p>
                        <p className="text-sm text-green-600">{uploadedFile.name}</p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setUploadedFile(null);
                            fileForm.setValue("file", null);
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