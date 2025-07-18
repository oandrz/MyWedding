import { motion } from "framer-motion";
import { useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Upload, Cloud, ExternalLink, Camera, Video, Heart } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { fadeIn, staggerContainer } from "@/lib/animations";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";

const MemoriesGoogleDrive = () => {
  const sectionRef = useRef(null);
  const [embedVisible, setEmbedVisible] = useState(false);
  
  // Google Drive folder URL (replace with actual wedding folder)
  const googleDriveUrl = "https://drive.google.com/drive/folders/1234567890abcdef?usp=sharing";
  const embedUrl = "https://drive.google.com/embeddedfolderview?id=1234567890abcdef#grid";

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50 to-pink-50">
      <NavBar />
      
      <main className="pt-20">
        <section ref={sectionRef} className="py-12">
          <div className="container mx-auto px-4 max-w-4xl">
            
            {/* Back Button */}
            <motion.div 
              className="mb-6"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Link href="/memories">
                <Button variant="outline" className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Original Upload
                </Button>
              </Link>
            </motion.div>

            {/* Header */}
            <motion.div 
              className="text-center mb-12"
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
            >
              <motion.div 
                className="flex items-center justify-center gap-3 mb-4"
                variants={fadeIn}
              >
                <Cloud className="h-8 w-8 text-blue-600" />
                <h1 className="text-4xl font-cormorant text-gray-900">
                  Share Your Memories
                </h1>
              </motion.div>
              
              <motion.div 
                className="w-20 h-0.5 bg-rose-400 mx-auto mb-6"
                variants={fadeIn}
              />
              
              <motion.p 
                className="text-gray-600 font-montserrat max-w-2xl mx-auto text-lg"
                variants={fadeIn}
              >
                Upload your photos and videos directly to our shared Google Drive folder. 
                Fast, easy, and familiar - just like sharing with family!
              </motion.p>
            </motion.div>

            {/* Benefits Section */}
            <motion.div 
              className="grid md:grid-cols-3 gap-6 mb-8"
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
            >
              <motion.div variants={fadeIn}>
                <Card className="text-center h-full border-2 border-blue-100">
                  <CardContent className="p-6">
                    <Upload className="h-8 w-8 text-blue-600 mx-auto mb-3" />
                    <h3 className="font-semibold text-gray-900 mb-2">Faster Uploads</h3>
                    <p className="text-gray-600 text-sm">Google's powerful servers ensure quick uploads, even for large video files</p>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div variants={fadeIn}>
                <Card className="text-center h-full border-2 border-green-100">
                  <CardContent className="p-6">
                    <Camera className="h-8 w-8 text-green-600 mx-auto mb-3" />
                    <h3 className="font-semibold text-gray-900 mb-2">Any File Type</h3>
                    <p className="text-gray-600 text-sm">Photos, videos, documents - upload everything in one place</p>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div variants={fadeIn}>
                <Card className="text-center h-full border-2 border-purple-100">
                  <CardContent className="p-6">
                    <Heart className="h-8 w-8 text-purple-600 mx-auto mb-3" />
                    <h3 className="font-semibold text-gray-900 mb-2">Familiar Interface</h3>
                    <p className="text-gray-600 text-sm">Use the Google Drive interface you already know and love</p>
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>

            {/* Action Buttons */}
            <motion.div 
              className="flex flex-col sm:flex-row gap-4 justify-center mb-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <Button 
                onClick={() => window.open(googleDriveUrl, '_blank')}
                className="bg-blue-600 hover:bg-blue-700 text-white gap-2 px-8 py-3"
                size="lg"
              >
                <ExternalLink className="h-5 w-5" />
                Open Google Drive Folder
              </Button>
              
              <Button 
                onClick={() => setEmbedVisible(!embedVisible)}
                variant="outline"
                className="gap-2 px-8 py-3"
                size="lg"
              >
                <Cloud className="h-5 w-5" />
                {embedVisible ? 'Hide' : 'Show'} Embedded View
              </Button>
            </motion.div>

            {/* Instructions */}
            <motion.div 
              className="mb-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
            >
              <Alert className="border-blue-200 bg-blue-50">
                <Cloud className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800">
                  <strong>How to upload:</strong> Click "Open Google Drive Folder" above, then drag and drop your photos/videos or click the "+" button to add files. No account required!
                </AlertDescription>
              </Alert>
            </motion.div>

            {/* Embedded Google Drive */}
            {embedVisible && (
              <motion.div 
                className="mb-8"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 600 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.5 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="text-center">Wedding Memories Folder</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <iframe
                      src={embedUrl}
                      className="w-full h-96 border-0 rounded-b-lg"
                      title="Wedding Memories Google Drive Folder"
                      style={{ minHeight: '500px' }}
                    />
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* A/B Testing Notice */}
            <motion.div 
              className="text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9 }}
            >
              <Card className="bg-gradient-to-r from-rose-50 to-pink-50 border-rose-200">
                <CardContent className="p-6">
                  <h3 className="font-semibold text-gray-900 mb-2">Help Us Improve!</h3>
                  <p className="text-gray-600 text-sm mb-4">
                    We're testing different upload methods to make sharing memories as easy as possible. 
                    Your feedback helps us choose the best experience for future couples.
                  </p>
                  <div className="flex gap-4 justify-center">
                    <Link href="/memories">
                      <Button variant="outline" size="sm">
                        Try Original Upload
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

export default MemoriesGoogleDrive;