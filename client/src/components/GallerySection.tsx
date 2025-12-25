import { motion, useInView } from "framer-motion";
import { useRef, useState, useEffect } from "react";
import { GALLERY_PHOTOS } from "@/lib/constants";
import { fadeIn, staggerContainer, scaleOnHover, staggerFast, revealText } from "@/lib/animations";
import { useQuery } from "@tanstack/react-query";
import type { ConfigImage } from "@shared/schema";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

// Helper: Generate responsive Unsplash URLs with optimized sizing
const getResponsiveImageUrl = (baseUrl: string, width: number, quality: number = 75): string => {
  // #region agent log
  const isUnsplash = baseUrl.includes('unsplash.com');
  fetch('http://127.0.0.1:7242/ingest/da997407-4aba-4420-8dd6-4151cd4b9a7a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'GallerySection.tsx:getResponsiveImageUrl',message:'Image URL optimization check',data:{baseUrl:baseUrl.substring(0,100),width,quality,isUnsplash,willOptimize:isUnsplash},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'D'})}).catch(()=>{});
  // #endregion
  if (!baseUrl.includes('unsplash.com')) return baseUrl;
  
  // Parse existing URL
  const url = new URL(baseUrl);
  url.searchParams.set('w', width.toString());
  url.searchParams.set('q', quality.toString());
  url.searchParams.set('auto', 'format'); // Let Unsplash choose best format (WebP when supported)
  url.searchParams.set('fit', 'crop');
  
  return url.toString();
};

// Optimized Image Component - uses thumbnail for fast loading
const OptimizedImage = ({ thumbnail, alt, index }: { thumbnail: string; alt: string; index: number }) => {
  // Fallback to empty string if thumbnail is undefined
  const safeThumb = thumbnail || '';
  
  // For Unsplash images, use optimized URL; for local images, use thumbnail directly
  const optimizedSrc = safeThumb.includes('unsplash.com') 
    ? getResponsiveImageUrl(safeThumb, 600, 70)
    : safeThumb;
  
  return (
    <div className="relative w-full h-64 bg-gray-100 overflow-hidden">
      <img 
        src={optimizedSrc}
        alt={alt}
        className="w-full h-64 object-cover"
        loading={index < 8 ? "eager" : "lazy"}
        decoding="async"
      />
    </div>
  );
};

const GallerySection = () => {
  const sectionRef = useRef(null);
  const titleRef = useRef(null);
  const galleryRef = useRef(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  
  const isSectionInView = useInView(sectionRef, { once: true, amount: 0.1 });
  const isTitleInView = useInView(titleRef, { once: true, amount: 0.3 });
  const isGalleryInView = useInView(galleryRef, { once: true, amount: 0.1 });

  // #region agent log
  const apiCallStartTime = useRef(Date.now());
  const mountCount = useRef(0);
  useEffect(() => {
    mountCount.current++;
    const mountTime = Date.now();
    fetch('http://127.0.0.1:7242/ingest/da997407-4aba-4420-8dd6-4151cd4b9a7a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'GallerySection.tsx:mount',message:'Component mounted',data:{mountCount:mountCount.current,mountTime},timestamp:mountTime,sessionId:'debug-session',hypothesisId:'F'})}).catch(()=>{});
    return () => {
      fetch('http://127.0.0.1:7242/ingest/da997407-4aba-4420-8dd6-4151cd4b9a7a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'GallerySection.tsx:unmount',message:'Component unmounted',data:{mountCount:mountCount.current,unmountTime:Date.now()},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'F'})}).catch(()=>{});
    };
  }, []);
  // #endregion
  
  // Fetch gallery images from API - smart caching for performance
  // FIX: Use placeholderData to show fallback images IMMEDIATELY while API loads
  // This prevents the 19-second wait for API timeout when database is unavailable
  const { data: galleryData, isLoading, error } = useQuery<{ images: ConfigImage[] }>({
    queryKey: ["/api/config-images/gallery"],
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes (v5 uses gcTime instead of cacheTime)
    refetchOnWindowFocus: false, // Don't refetch on focus to reduce network calls
    retry: 1, // Only retry once to reduce wait time on failures
    retryDelay: 1000, // 1 second between retries
    // Provide placeholder data so UI renders immediately with fallback images
    placeholderData: { images: [] },
  });
  
  // #region agent log
  useEffect(() => {
    const apiCallDuration = Date.now() - apiCallStartTime.current;
    fetch('http://127.0.0.1:7242/ingest/da997407-4aba-4420-8dd6-4151cd4b9a7a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'GallerySection.tsx:apiState',message:'Gallery API state change',data:{isLoading,hasData:!!galleryData,hasError:!!error,imageCount:galleryData?.images?.length || 0,apiCallDuration,errorMessage:error?.toString()?.substring(0,100)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})}).catch(()=>{});
  }, [isLoading, galleryData, error]);
  // #endregion

  // Use configurable images if available, otherwise fallback to constants
  const galleryImages = galleryData?.images && galleryData.images.length > 0
    ? galleryData.images.map(img => ({
        src: img.imageUrl,
        thumbnail: (img as any).thumbnailUrl || img.imageUrl,
        alt: img.title || img.description || "Gallery image"
      }))
    : GALLERY_PHOTOS.map(p => ({ ...p, thumbnail: p.src }));

  // Hide gallery section if no images are configured
  // FIX: Show gallery if we have configured images OR if fallback GALLERY_PHOTOS exist
  const hasConfiguredImages = (galleryData?.images?.length ?? 0) > 0;
  const shouldShowGallery = hasConfiguredImages || GALLERY_PHOTOS.length > 0;

  // Keyboard navigation
  useEffect(() => {
    if (selectedImageIndex === null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        handlePrevious();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'Escape') {
        setSelectedImageIndex(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedImageIndex, galleryImages.length]);

  const handlePrevious = () => {
    if (selectedImageIndex === null) return;
    setSelectedImageIndex((selectedImageIndex - 1 + galleryImages.length) % galleryImages.length);
  };

  const handleNext = () => {
    if (selectedImageIndex === null) return;
    setSelectedImageIndex((selectedImageIndex + 1) % galleryImages.length);
  };

  if (!shouldShowGallery) {
    return null;
  }
  
  return (
    <section id="gallery" className="py-20 bg-gradient-to-b from-white via-rose-50/30 to-white paper-texture" ref={sectionRef}>
      <div className="container mx-auto px-4">
        <motion.div 
          className="text-center mb-16"
          ref={titleRef}
          variants={staggerContainer}
          initial="hidden"
          animate={isTitleInView ? "visible" : "hidden"}
        >
          <motion.h2 
            className="text-5xl md:text-6xl font-cormorant font-bold text-foreground mb-4"
            variants={revealText}
          >
            Our Gallery
          </motion.h2>
          <motion.div 
            className="w-24 h-1 metallic-rose mx-auto rounded-full mb-6"
            variants={fadeIn}
          ></motion.div>
          <motion.p 
            className="text-muted-foreground font-montserrat text-lg max-w-2xl mx-auto"
            variants={fadeIn}
          >
            A glimpse into our journey together and the moments that led us here
          </motion.p>
        </motion.div>
        
        <motion.div 
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6"
          ref={galleryRef}
          variants={staggerFast}
          initial="hidden"
          animate={isGalleryInView ? "visible" : "hidden"}
        >
          {isLoading ? (
            // Loading skeleton
            Array.from({ length: 8 }).map((_, index) => (
              <div 
                key={index}
                className="h-64 bg-gray-200 animate-pulse rounded-lg"
              />
            ))
          ) : (
            galleryImages.map((photo, index) => (
              <motion.div 
                key={index}
                className="overflow-hidden rounded-xl shadow-lg cursor-pointer ring-2 ring-transparent hover:ring-primary/30 transition-all"
                variants={fadeIn}
                custom={index}
                transition={{ delay: index * 0.1 }}
                whileHover={{ scale: 1.03, y: -4 }}
                onClick={() => setSelectedImageIndex(index)}
                data-testid={`gallery-image-${index}`}
              >
                <OptimizedImage 
                  thumbnail={photo.thumbnail} 
                  alt={photo.alt}
                  index={index}
                />
              </motion.div>
            ))
          )}
        </motion.div>
      </div>

      {/* Image Viewer Modal */}
      <Dialog open={selectedImageIndex !== null} onOpenChange={(open) => !open && setSelectedImageIndex(null)}>
        <DialogContent className="max-w-[100vw] max-h-[100vh] w-full h-full p-0 bg-black/95 border-none overflow-hidden">
          <VisuallyHidden>
            <DialogTitle>Image Viewer</DialogTitle>
            <DialogDescription>
              Viewing image {selectedImageIndex !== null ? selectedImageIndex + 1 : 0} of {galleryImages.length}. Use arrow keys or navigation buttons to browse.
            </DialogDescription>
          </VisuallyHidden>
          {selectedImageIndex !== null && (
            <div className="relative w-full h-full flex items-center justify-center p-4 md:p-8">
              {/* Close button */}
              <button
                onClick={() => setSelectedImageIndex(null)}
                className="fixed top-2 right-2 md:top-4 md:right-4 z-[60] p-2 md:p-3 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors touch-manipulation"
                data-testid="close-image-viewer"
                aria-label="Close image viewer"
              >
                <X className="w-5 h-5 md:w-6 md:h-6" />
              </button>

              {/* Image counter */}
              <div className="fixed top-2 left-1/2 -translate-x-1/2 md:top-4 z-[60] px-3 py-1.5 md:px-4 md:py-2 bg-black/50 rounded-full text-white font-montserrat text-xs md:text-sm">
                {selectedImageIndex + 1} / {galleryImages.length}
              </div>

              {/* Previous button */}
              {galleryImages.length > 1 && (
                <button
                  onClick={handlePrevious}
                  className="fixed left-2 top-1/2 -translate-y-1/2 md:left-4 z-[60] p-2 md:p-3 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors touch-manipulation"
                  data-testid="previous-image"
                  aria-label="Previous image"
                >
                  <ChevronLeft className="w-6 h-6 md:w-8 md:h-8" />
                </button>
              )}

              {/* Full-size image - responsive sizing to prevent cropping */}
              <div className="flex items-center justify-center w-full h-full">
                <img
                  src={galleryImages[selectedImageIndex].src}
                  alt={galleryImages[selectedImageIndex].alt}
                  className="max-w-[calc(100vw-80px)] max-h-[calc(100vh-80px)] md:max-w-[calc(100vw-120px)] md:max-h-[calc(100vh-120px)] w-auto h-auto object-contain"
                  data-testid="fullsize-image"
                />
              </div>

              {/* Next button */}
              {galleryImages.length > 1 && (
                <button
                  onClick={handleNext}
                  className="fixed right-2 top-1/2 -translate-y-1/2 md:right-4 z-[60] p-2 md:p-3 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors touch-manipulation"
                  data-testid="next-image"
                  aria-label="Next image"
                >
                  <ChevronRight className="w-6 h-6 md:w-8 md:h-8" />
                </button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default GallerySection;
