import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import NavBar from '@/components/NavBar';
import Footer from '@/components/Footer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, Cloud, Check, AlertCircle, Image as ImageIcon, Video, FileText, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { fadeIn, staggerContainer } from '@/lib/animations';
import { Link } from 'wouter';

const MemoriesGoogleDriveUpload = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [guestName, setGuestName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleOAuthSetup = async () => {
    try {
      const response = await fetch('/api/google-auth-url');
      const data = await response.json();
      
      if (data.authUrl) {
        toast({
          title: "Authorization Required",
          description: "Opening Google authorization page to enable direct uploads",
          variant: "default"
        });
        
        // Open authorization URL in new window
        window.open(data.authUrl, '_blank', 'width=500,height=600');
      }
    } catch (error) {
      console.error('Error getting auth URL:', error);
      toast({
        title: "Setup Error",
        description: "Could not initiate Google Drive authorization",
        variant: "destructive"
      });
    }
  };

  // Google Drive folder URL for wedding memories
  const googleDriveUrl = "https://drive.google.com/drive/folders/1InY5WMWJ4OOQZFv3SXEljD0JnSP5eEQC?usp=sharing";
  const embedUrl = "https://drive.google.com/embeddedfolderview?id=1InY5WMWJ4OOQZFv3SXEljD0JnSP5eEQC#grid";

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
    const fileArray = Array.from(files);
    setSelectedFiles(fileArray);
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      toast({
        title: "No files selected",
        description: "Please select files to upload",
        variant: "destructive"
      });
      return;
    }

    setIsUploading(true);
    
    try {
      const formData = new FormData();
      
      // Add all selected files
      selectedFiles.forEach((file) => {
        formData.append('files', file);
      });
      
      // Add guest name if provided
      if (guestName.trim()) {
        formData.append('guestName', guestName.trim());
      }

      const response = await fetch('/api/upload-to-drive', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (response.ok) {
        const successCount = result.results?.filter((r: any) => r.success).length || 0;
        const failCount = result.results?.filter((r: any) => !r.success).length || 0;
        
        if (successCount > 0) {
          setUploadSuccess(true);
          setSelectedFiles([]);
          
          toast({
            title: "Upload successful!",
            description: `${successCount} file(s) uploaded to Google Drive`,
            variant: "default"
          });
          
          // Reset success state after 3 seconds
          setTimeout(() => {
            setUploadSuccess(false);
          }, 3000);
        } else if (failCount > 0) {
          // Check if it's an OAuth requirement error
          const oauthError = result.results?.find((r: any) => 
            r.error?.includes('OAUTH_REQUIRED')
          );
          
          setSelectedFiles([]);
          
          if (oauthError) {
            // Handle OAuth requirement
            handleOAuthSetup();
          } else {
            toast({
              title: "Direct upload not available",
              description: "Opening Google Drive folder for manual upload",
              variant: "default"
            });
            
            // Open Google Drive folder in new tab for manual upload
            setTimeout(() => {
              window.open(googleDriveUrl, '_blank');
            }, 1000);
          }
        }
      } else {
        throw new Error(result.message || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: (error as Error).message || "Failed to upload files to Google Drive",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return <ImageIcon className="h-8 w-8 text-blue-500" />;
    if (file.type.startsWith('video/')) return <Video className="h-8 w-8 text-purple-500" />;
    return <FileText className="h-8 w-8 text-gray-500" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1048576) return Math.round(bytes / 1024) + ' KB';
    else return Math.round(bytes / 1048576) + ' MB';
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50 to-pink-50">
      <NavBar />
      
      <main className="pt-24">
        <section className="py-16 px-4">
          <div className="max-w-4xl mx-auto">
            {/* Hero Section */}
            <motion.div 
              className="text-center mb-12"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <h1 className="text-4xl md:text-5xl font-cormorant font-bold text-gray-900 mb-4">
                Share Your Memories
              </h1>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                Upload your photos and videos directly to our wedding memories folder
              </p>
            </motion.div>

            {/* Upload Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <Card className="shadow-xl">
                <CardHeader className="bg-gradient-to-r from-rose-100 to-pink-100">
                  <CardTitle className="text-2xl text-center">
                    <Cloud className="h-8 w-8 mx-auto mb-2 text-rose-600" />
                    Google Drive Upload
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-8">
                  {/* Drag and Drop Zone */}
                  <div
                    className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-all ${
                      dragActive 
                        ? 'border-rose-500 bg-rose-50' 
                        : 'border-gray-300 hover:border-rose-400 hover:bg-rose-50/50'
                    }`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(e) => e.target.files && handleFiles(e.target.files)}
                      accept="image/*,video/*"
                    />
                    
                    <AnimatePresence mode="wait">
                      {uploadSuccess ? (
                        <motion.div
                          key="success"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          exit={{ scale: 0 }}
                          className="py-8"
                        >
                          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
                            <Check className="h-8 w-8 text-green-600" />
                          </div>
                          <p className="text-lg font-semibold text-green-700">Ready to Upload!</p>
                          <p className="text-sm text-green-600 mt-2">Google Drive folder will open shortly</p>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="upload"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                        >
                          <Upload className="h-12 w-12 mx-auto mb-4 text-rose-400" />
                          <p className="text-lg font-semibold mb-2">
                            {dragActive ? 'Drop files here' : 'Drag & drop your files here'}
                          </p>
                          <p className="text-sm text-gray-600 mb-4">
                            or click to browse
                          </p>
                          <p className="text-xs text-gray-500">
                            Supports images and videos up to 100MB
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Selected Files List */}
                  {selectedFiles.length > 0 && (
                    <motion.div
                      className="mt-6"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <h3 className="font-semibold mb-3">Selected Files ({selectedFiles.length})</h3>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {selectedFiles.map((file, index) => (
                          <div
                            key={index}
                            className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                          >
                            {getFileIcon(file)}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{file.name}</p>
                              <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedFiles(files => files.filter((_, i) => i !== index));
                              }}
                              className="text-red-500 hover:text-red-700"
                            >
                              <AlertCircle className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* Guest Name Input */}
                  <motion.div
                    className="mt-6"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                  >
                    <label htmlFor="guestName" className="block text-sm font-medium text-gray-700 mb-2">
                      Your Name (Optional)
                    </label>
                    <input
                      type="text"
                      id="guestName"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      placeholder="Enter your name to identify your photos"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                    />
                  </motion.div>

                  {/* Upload Button */}
                  <motion.div
                    className="mt-6 flex justify-center"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                  >
                    <Button
                      onClick={handleUpload}
                      disabled={selectedFiles.length === 0 || isUploading}
                      className="px-8 py-3 bg-rose-600 hover:bg-rose-700 text-white"
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Preparing upload...
                        </>
                      ) : (
                        <>
                          <Cloud className="mr-2 h-4 w-4" />
                          Upload to Google Drive
                        </>
                      )}
                    </Button>
                  </motion.div>

                  {/* Instructions */}
                  <Alert className="mt-6 border-blue-200 bg-blue-50">
                    <AlertDescription className="text-blue-800">
                      <strong>Upload Process:</strong> Select your photos and click upload. If direct upload is available, your photos will be automatically added to our Google Drive folder. Otherwise, you'll be guided to the folder to add them manually.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            </motion.div>

            {/* View Folder Button */}
            <motion.div
              className="mt-8 text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <Button
                variant="outline"
                asChild
                className="gap-2"
              >
                <a href={googleDriveUrl} target="_blank" rel="noopener noreferrer">
                  <Cloud className="h-4 w-4" />
                  View Google Drive Folder
                </a>
              </Button>
            </motion.div>

            {/* Alternative Options */}
            <motion.div 
              className="mt-12 text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
            >
              <Card className="bg-gradient-to-r from-rose-50 to-pink-50 border-rose-200">
                <CardContent className="p-6">
                  <p className="text-gray-600 text-sm mb-4">
                    Having trouble? You can also upload directly through Google Drive
                  </p>
                  <div className="flex gap-4 justify-center">
                    <Link href="/memories">
                      <Button variant="outline" size="sm">
                        Try Traditional Upload
                      </Button>
                    </Link>
                    <Link href="/memories-drive">
                      <Button variant="outline" size="sm">
                        View Embedded Folder
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </section>
      </main>
      
      <Footer />
    </div>
  );
};

export default MemoriesGoogleDriveUpload;