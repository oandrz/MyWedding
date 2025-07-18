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
import { Link } from "wouter";
import { Camera, Upload, Users, Clock, CheckCircle, XCircle, Plus, FileText, Image as ImageIcon, ExternalLink } from "lucide-react";

// Simplified schema for quick memory sharing
const formSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }).optional(),
  email: z.string().email({ message: "Please enter a valid email address." }).optional(),
  mediaUrl: z.string().url({ message: "Please enter a valid URL." }),
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
      name: "Anonymous",
      email: "guest@event.com", 
      mediaUrl: "",
      caption: "",
    },
  });

  // Query for fetching approved media
  const { data, isLoading, error } = useQuery<{ media: Media[] }>({
    queryKey: ["/api/media"],
    enabled: activeTab === "view",
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {data && data.media && data.media.map((item: Media) => (
                  <Card key={item.id} className="overflow-hidden h-full">
                    <CardContent className="p-4">
                      {renderMedia(item)}
                      <h3 className="font-semibold text-lg">{item.name}</h3>
                      {item.caption && <p className="text-gray-600 mt-1">{item.caption}</p>}
                      <p className="text-xs text-gray-400 mt-2">
                        Shared on {new Date(item.createdAt).toLocaleDateString()}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500">No memories have been shared yet.</p>
                <p className="mt-2">
                  Be the first to share your special memory by clicking on "Share Your Memory"!
                </p>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="share" className="mt-6">
            <Card>
              <CardContent className="pt-6">
                <div className="mb-6">
                  <h2 className="text-xl font-semibold mb-2">Share Your Memory</h2>
                  <p className="text-gray-600">
                    Quickly share photos or videos from our wedding! Perfect for capturing moments during the event.
                    Name and email are optional - just upload and share instantly.
                  </p>
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-blue-800 text-sm mb-2">
                      <strong>New!</strong> Try our Google Drive option for faster uploads:
                    </p>
                    <Link href="/memories-drive">
                      <Button variant="outline" size="sm" className="gap-2">
                        <ExternalLink className="h-4 w-4" />
                        Upload via Google Drive
                      </Button>
                    </Link>
                  </div>
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
                                <FormLabel>Your Name (Optional)</FormLabel>
                                <FormControl>
                                  <Input placeholder="Anonymous" {...field} />
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
                                <FormLabel>Email (Optional)</FormLabel>
                                <FormControl>
                                  <Input placeholder="guest@event.com" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        
                        <FormField
                          control={form.control}
                          name="mediaUrl"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Media URL</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="https://example.com/your-image.jpg or https://youtube.com/embed/your-video-id" 
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                              <p className="text-xs text-gray-500 mt-1">
                                Share an image link or YouTube video URL. The system will automatically detect the media type.
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
                            Your Name (Optional)
                          </label>
                          <Input 
                            id="name" 
                            name="name" 
                            placeholder="Anonymous" 
                            defaultValue="Anonymous"
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <label htmlFor="email" className="text-sm font-medium">
                            Email (Optional)
                          </label>
                          <Input 
                            id="email" 
                            name="email" 
                            type="email" 
                            placeholder="guest@event.com" 
                            defaultValue="guest@event.com"
                          />
                        </div>
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