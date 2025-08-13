import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { insertMediaSchema } from "../../../shared/schema";
import NavBar from "@/components/NavBar";
import { Upload } from "lucide-react";
import { Suspense, lazy, memo } from "react";

// Extend the schema for form validation
const formSchema = insertMediaSchema.extend({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  email: z.string().email({ message: "Please enter a valid email address." }),
  mediaUrl: z.string().url({ message: "Please enter a valid URL." }),
  mediaType: z.enum(["image", "video"], {
    required_error: "Please select a media type.",
  }),
  caption: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface Media {
  id: number;
  name: string;
  email: string;
  mediaUrl: string;
  mediaType: "image" | "video";
  caption: string | null;
  approved: boolean;
  createdAt: string;
}

// Memoized gallery item component for better performance
const GalleryItem = memo(({ item }: { item: Media }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  return (
    <Card key={item.id} className="overflow-hidden hover:shadow-lg transition-shadow duration-300">
      <CardContent className="p-0">
        {item.mediaType === "image" ? (
          <div className="relative aspect-square bg-gray-100">
            {!imageLoaded && !imageError && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            )}
            {imageError ? (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
                <p className="text-gray-500 text-sm">Failed to load image</p>
              </div>
            ) : (
              <img
                src={item.mediaUrl}
                alt={item.caption || "Gallery image"}
                className={`w-full h-full object-cover transition-opacity duration-300 ${
                  imageLoaded ? 'opacity-100' : 'opacity-0'
                }`}
                loading="lazy"
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageError(true)}
              />
            )}
          </div>
        ) : (
          <div className="relative aspect-square bg-black">
            <video
              src={item.mediaUrl}
              controls
              className="w-full h-full object-contain"
              preload="metadata"
            >
              Your browser does not support the video tag.
            </video>
          </div>
        )}
        {item.caption && (
          <div className="p-4">
            <p className="text-sm text-muted-foreground">{item.caption}</p>
            <p className="text-xs text-muted-foreground mt-2">- {item.name}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
});

GalleryItem.displayName = 'GalleryItem';

const Gallery = () => {
  const [activeTab, setActiveTab] = useState("view");
  const [uploadTab, setUploadTab] = useState<"link" | "file">("link");
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form for submitting new media
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      mediaUrl: "",
      mediaType: "image",
      caption: "",
    },
  });

  // Query for fetching approved media
  const { data, isLoading, error } = useQuery<{ media: Media[] }>({
    queryKey: ["/api/media"],
    enabled: activeTab === "view",
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/media");
      return response.json();
    },
  });

  // Mutation for submitting new media
  const { mutate, isPending } = useMutation({
    mutationFn: (values: FormValues) => 
      apiRequest("POST", "/api/media", values),
    onSuccess: () => {
      toast({
        title: "Success!",
        description: "Your memory has been shared and added to the gallery.",
      });
      form.reset();
      // Invalidate the query cache to refresh the gallery data
      queryClient.invalidateQueries({ queryKey: ["/api/media"] });
      // Switch to the view tab to show the updated gallery
      setActiveTab("view");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to share your memory. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: FormValues) => {
    mutate(values);
  };

  // File upload mutation
  const { mutate: uploadFile, isPending: isUploading } = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to upload file');
      }
      
      return response.json();
    },
    onSuccess: () => {
      setUploading(false);
      toast({
        title: "Upload Successful!",
        description: "Your memory has been shared and added to the gallery.",
      });
      // Invalidate the query cache to refresh the gallery data
      queryClient.invalidateQueries({ queryKey: ["/api/media"] });
      // Switch to the view tab to show the updated gallery
      setActiveTab("view");
    },
    onError: (error: any) => {
      setUploading(false);
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload your file. Please try again.",
        variant: "destructive",
      });
    }
  });
  
  // Handle file selection
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file.name);
    } else {
      setSelectedFile(null);
    }
  };
  
  // Handle file upload
  const handleFileUpload = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    
    // Get form data
    const formElement = event.currentTarget;
    const formData = new FormData(formElement);
    
    // Check if file was selected
    const file = formData.get('file') as File;
    if (!file || file.size === 0) {
      toast({
        title: "Error",
        description: "Please select a file to upload.",
        variant: "destructive",
      });
      return;
    }
    
    // Check file type
    const fileType = formData.get('mediaType') as string;
    if (!fileType) {
      toast({
        title: "Error",
        description: "Please select a media type.",
        variant: "destructive",
      });
      return;
    }
    
    // Set uploading state and submit the file
    setUploading(true);
    uploadFile(formData);
  };
  
  // Render media item
  const renderMedia = (item: Media) => {
    if (item.mediaType === "image") {
      return (
        <div className="relative aspect-video overflow-hidden rounded-md mb-2">
          <img
            src={item.mediaUrl}
            alt={item.caption || `Image shared by ${item.name}`}
            className="object-cover w-full h-full"
          />
        </div>
      );
    } else if (item.mediaType === "video") {
      // Handle both YouTube embeds and uploaded videos
      if (item.mediaUrl.includes('youtube.com') || item.mediaUrl.includes('youtu.be')) {
        return (
          <div className="relative aspect-video overflow-hidden rounded-md mb-2">
            <iframe
              src={item.mediaUrl}
              title={item.caption || `Video shared by ${item.name}`}
              allowFullScreen
              className="w-full h-full"
            ></iframe>
          </div>
        );
      } else {
        // For local or direct video URLs
        return (
          <div className="relative aspect-video overflow-hidden rounded-md mb-2">
            <video 
              src={item.mediaUrl} 
              controls 
              className="w-full h-full"
              title={item.caption || `Video shared by ${item.name}`}
            />
          </div>
        );
      }
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-white">
      <NavBar />
      <div className="container py-24 max-w-5xl mx-auto px-4">
        <h1 className="text-4xl font-bold text-center mb-2">Memories Gallery</h1>
        <p className="text-center text-gray-600 mb-8">
          Share and view cherished moments from our wedding journey
        </p>

        <Tabs defaultValue="view" value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="view">View Gallery</TabsTrigger>
            <TabsTrigger value="share">Share Your Memory</TabsTrigger>
          </TabsList>
          
          <TabsContent value="view" className="mt-6">
            {isLoading ? (
              <div className="text-center py-12">Loading memories...</div>
            ) : error ? (
              <div className="text-center py-12 text-red-500">
                Failed to load memories. Please try again later.
              </div>
            ) : data && data.media && data.media.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {data && data.media.map((item) => (
                  <GalleryItem key={item.id} item={item} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">No memories shared yet. Be the first!</p>
                <Button onClick={() => setActiveTab("share")}>Share a Memory</Button>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="share" className="mt-6">
            <Card>
              <CardContent className="pt-6">
                <div className="mb-6">
                  <h2 className="text-xl font-semibold mb-2">Share Your Memory</h2>
                  <p className="text-gray-600">
                    Please share photos or videos from our wedding or related events.
                    All shared memories will appear immediately in the gallery.
                  </p>
                </div>
                
                <Separator className="my-6" />
                
                <Tabs defaultValue="link" value={uploadTab} onValueChange={(value) => setUploadTab(value as "link" | "file")} className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="link">Share via URL</TabsTrigger>
                    <TabsTrigger value="file">Upload from Device</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="link" className="mt-6">
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Your Name</FormLabel>
                                <FormControl>
                                  <Input placeholder="Enter your name" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Email Address</FormLabel>
                                <FormControl>
                                  <Input placeholder="your@email.com" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        
                        <FormField
                          control={form.control}
                          name="mediaType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Media Type</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select media type" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="image">Image</SelectItem>
                                  <SelectItem value="video">Video</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="mediaUrl"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                {form.watch("mediaType") === "image" ? "Image URL" : "Video URL"}
                              </FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder={
                                    form.watch("mediaType") === "image" 
                                      ? "https://example.com/your-image.jpg" 
                                      : "https://youtube.com/embed/your-video-id"
                                  } 
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                              <p className="text-xs text-gray-500 mt-1">
                                {form.watch("mediaType") === "image" 
                                  ? "Please provide a direct link to your image (e.g., from Imgur, Google Photos)" 
                                  : "For YouTube videos, use the embed link format: https://youtube.com/embed/YOUR_VIDEO_ID"
                                }
                              </p>
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="caption"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Caption (Optional)</FormLabel>
                              <FormControl>
                                <Textarea 
                                  placeholder="Add a caption to your memory..." 
                                  className="resize-none" 
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <Button type="submit" className="w-full" disabled={isPending}>
                          {isPending ? "Submitting..." : "Share Memory via URL"}
                        </Button>
                      </form>
                    </Form>
                  </TabsContent>
                  
                  <TabsContent value="file" className="mt-6">
                    <form onSubmit={handleFileUpload} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label htmlFor="name" className="text-sm font-medium">
                            Your Name
                          </label>
                          <Input 
                            id="name" 
                            name="name" 
                            required 
                            placeholder="Enter your name" 
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <label htmlFor="email" className="text-sm font-medium">
                            Email Address
                          </label>
                          <Input 
                            id="email" 
                            name="email" 
                            type="email" 
                            required 
                            placeholder="your@email.com" 
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <label htmlFor="mediaType" className="text-sm font-medium">
                          Media Type
                        </label>
                        <select 
                          id="mediaType" 
                          name="mediaType" 
                          required 
                          className="w-full rounded-md border border-input bg-background px-3 py-2"
                        >
                          <option value="">Select media type</option>
                          <option value="image">Image</option>
                          <option value="video">Video</option>
                        </select>
                        <p className="text-xs text-gray-500">
                          Select the type of media you are uploading
                        </p>
                      </div>
                      
                      <div className="space-y-2">
                        <label htmlFor="file" className="text-sm font-medium">
                          Upload File
                        </label>
                        <div className="border-2 border-dashed border-gray-300 rounded-md p-6 text-center cursor-pointer hover:bg-gray-50"
                          onClick={() => fileInputRef.current?.click()}>
                          <Upload className="mx-auto h-12 w-12 text-gray-400" />
                          <p className="mt-2 text-sm text-gray-600">
                            Click to select a file, or drag and drop
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            Images (JPG, PNG, GIF) or Videos (MP4) up to 10MB
                          </p>
                          <input
                            id="file"
                            name="file"
                            type="file"
                            className="hidden"
                            accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime"
                            ref={fileInputRef}
                            required
                            onChange={handleFileChange}
                          />
                        </div>
                        {selectedFile && (
                          <p className="text-sm text-green-600">
                            File selected: {selectedFile}
                          </p>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <label htmlFor="caption" className="text-sm font-medium">
                          Caption (Optional)
                        </label>
                        <Textarea 
                          id="caption" 
                          name="caption" 
                          placeholder="Add a caption to your memory..." 
                          className="resize-none" 
                        />
                      </div>
                      
                      <Button type="submit" className="w-full" disabled={uploading}>
                        {uploading ? (
                          <span className="flex items-center gap-2">
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-opacity-20 border-t-white"></span>
                            Uploading...
                          </span>
                        ) : (
                          <span className="flex items-center gap-2">
                            <Upload className="h-4 w-4" />
                            Upload Memory
                          </span>
                        )}
                      </Button>
                    </form>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Gallery;