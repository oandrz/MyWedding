import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import NavBar from "@/components/NavBar";
import { Camera, Upload, Heart, Cloud, CheckCircle, Users } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [guestName, setGuestName] = useState("");
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Query for fetching approved media
  const { data, isLoading, error } = useQuery<{ media: Media[] }>({
    queryKey: ["/api/media"],
    enabled: activeTab === "view",
  });

  // Google Drive upload functionality
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
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleFiles = (files: FileList) => {
    const fileArray = Array.from(files).slice(0, 10); // Limit to 10 files
    setSelectedFiles(fileArray);
  };

  const handleGoogleDriveUpload = async () => {
    if (selectedFiles.length === 0) {
      toast({
        title: "No files selected",
        description: "Please choose some photos to share",
        variant: "destructive"
      });
      return;
    }

    setUploading(true);
    const formData = new FormData();
    
    selectedFiles.forEach((file) => {
      formData.append('files', file);
    });
    
    if (guestName.trim()) {
      formData.append('guestName', guestName.trim());
    }

    try {
      const response = await fetch('/api/upload-to-drive', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();
      
      toast({
        title: "Photos shared! ❤️",
        description: `Successfully shared ${result.successCount} photos to the wedding memories`,
      });
      
      setSelectedFiles([]);
      setGuestName("");
      setActiveTab("view");
      queryClient.invalidateQueries({ queryKey: ["/api/media"] });
      
    } catch (error) {
      toast({
        title: "Upload failed",
        description: "Couldn't share your photos right now. Please try again.",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
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
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl font-bold mb-2 flex items-center justify-center gap-3">
            <Camera className="h-8 w-8 text-rose-500" />
            Wedding Memories
          </h1>
          <p className="text-gray-600">
            Share and view precious moments from our special day
          </p>
        </motion.div>

        <Tabs defaultValue="view" value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="view" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              View Gallery
            </TabsTrigger>
            <TabsTrigger value="share" className="flex items-center gap-2">
              <Heart className="h-4 w-4" />
              Share Photos
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="view" className="mt-6">
            <AnimatePresence>
              {isLoading ? (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-12"
                >
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-rose-500"></div>
                  <p className="mt-4 text-gray-600">Loading precious memories...</p>
                </motion.div>
              ) : error ? (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-12 text-red-500"
                >
                  Failed to load memories. Please try again later.
                </motion.div>
              ) : (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-6"
                >
                  {/* Google Drive Embedded Folder */}
                  <div className="bg-gradient-to-r from-rose-50 to-pink-50 p-6 rounded-lg border border-rose-200">
                    <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                      <Heart className="h-5 w-5 text-rose-500" />
                      Live Wedding Photos
                    </h3>
                    <p className="text-gray-600 mb-4">
                      See all the amazing photos guests are sharing in real-time!
                    </p>
                    
                    <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
                      <iframe
                        src="https://drive.google.com/embeddedfolderview?id=1InY5WMWJ4OOQZFv3SXEljD0JnSP5eEQC#grid"
                        width="100%"
                        height="400"
                        frameBorder="0"
                        className="w-full"
                        title="Wedding Photos - Live Gallery"
                      ></iframe>
                    </div>
                    
                    <div className="mt-4 flex justify-center">
                      <a
                        href="https://drive.google.com/drive/folders/1InY5WMWJ4OOQZFv3SXEljD0JnSP5eEQC?usp=sharing"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-rose-600 hover:text-rose-700 transition-colors"
                      >
                        <Camera className="h-4 w-4" />
                        Open Full Gallery in New Window
                      </a>
                    </div>
                  </div>

                  {/* Individual Media Cards (if any local uploads exist) */}
                  {data && data.media && data.media.length > 0 && (
                    <div>
                      <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                        <Users className="h-5 w-5 text-gray-600" />
                        Individual Memories
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {data.media.map((item: Media, index) => (
                          <motion.div
                            key={item.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                          >
                            <Card className="overflow-hidden h-full hover:shadow-lg transition-shadow">
                              <CardContent className="p-4">
                                {renderMedia(item)}
                                <h3 className="font-semibold text-lg">{item.name}</h3>
                                {item.caption && <p className="text-gray-600 mt-1">{item.caption}</p>}
                                <p className="text-xs text-gray-400 mt-2">
                                  Shared on {new Date(item.createdAt).toLocaleDateString()}
                                </p>
                              </CardContent>
                            </Card>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </TabsContent>
          
          <TabsContent value="share" className="mt-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card>
                <CardContent className="pt-6">
                  <div className="mb-6">
                    <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">
                      <Heart className="h-5 w-5 text-rose-500" />
                      Share Your Photos
                    </h2>
                    <p className="text-gray-600">
                      Drag and drop your photos here or click to select. They'll be shared instantly with everyone!
                    </p>
                  </div>

                  {/* Google Drive Upload Interface */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <Input
                        placeholder="Your name (optional)"
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        className="max-w-sm"
                      />
                    </div>

                    {/* Drag and Drop Area */}
                    <div
                      className={`border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200 ${
                        dragActive 
                          ? "border-rose-400 bg-rose-50 scale-[1.02]" 
                          : "border-gray-300 hover:border-rose-300 hover:bg-gray-50"
                      }`}
                      onDragEnter={handleDrag}
                      onDragLeave={handleDrag}
                      onDragOver={handleDrag}
                      onDrop={handleDrop}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept="image/*,video/*"
                        onChange={(e) => e.target.files && handleFiles(e.target.files)}
                        className="hidden"
                      />
                      
                      <AnimatePresence mode="wait">
                        {selectedFiles.length > 0 ? (
                          <motion.div
                            key="files-selected"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                          >
                            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                            <p className="text-lg font-medium text-gray-900">
                              {selectedFiles.length} photo{selectedFiles.length !== 1 ? 's' : ''} ready to share
                            </p>
                            <div className="mt-2 space-y-1">
                              {selectedFiles.slice(0, 3).map((file, index) => (
                                <p key={index} className="text-sm text-gray-600">
                                  {file.name}
                                </p>
                              ))}
                              {selectedFiles.length > 3 && (
                                <p className="text-sm text-gray-600">
                                  ...and {selectedFiles.length - 3} more
                                </p>
                              )}
                            </div>
                          </motion.div>
                        ) : (
                          <motion.div
                            key="empty-state"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                          >
                            <Cloud className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                            <p className="text-lg font-medium text-gray-900 mb-2">
                              Drop your photos here
                            </p>
                            <p className="text-sm text-gray-600 mb-4">
                              or click to browse from your device
                            </p>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => fileInputRef.current?.click()}
                              className="gap-2"
                            >
                              <Upload className="h-4 w-4" />
                              Choose Photos
                            </Button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Upload Button */}
                    <AnimatePresence>
                      {selectedFiles.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -20 }}
                          className="flex justify-center"
                        >
                          <Button
                            onClick={handleGoogleDriveUpload}
                            disabled={uploading}
                            size="lg"
                            className="gap-2 bg-rose-500 hover:bg-rose-600"
                          >
                            {uploading ? (
                              <>
                                <motion.div
                                  animate={{ rotate: 360 }}
                                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                >
                                  <Upload className="h-4 w-4" />
                                </motion.div>
                                Sharing Photos...
                              </>
                            ) : (
                              <>
                                <Heart className="h-4 w-4" />
                                Share {selectedFiles.length} Photo{selectedFiles.length !== 1 ? 's' : ''}
                              </>
                            )}
                          </Button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Simple note with direct link to view */}
                  <div className="mt-6 p-4 bg-rose-50 rounded-lg border border-rose-200">
                    <p className="text-sm text-rose-800 text-center mb-2">
                      Photos uploaded here appear instantly in your Google Drive wedding folder!
                    </p>
                    <div className="flex justify-center">
                      <button 
                        onClick={() => setActiveTab("view")}
                        className="text-sm text-rose-600 hover:text-rose-700 underline"
                      >
                        View your uploaded photos →
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Gallery;