import { motion, useInView } from "framer-motion";
import { useRef, useState, useEffect } from "react";
import { GALLERY_PHOTOS } from "@/lib/constants";
import { fadeIn, staggerContainer, scaleOnHover } from "@/lib/animations";
import { useQuery } from "@tanstack/react-query";
import type { ConfigImage } from "@shared/schema";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

const GallerySection = () => {
  const sectionRef = useRef(null);
  const titleRef = useRef(null);
  const galleryRef = useRef(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  
  const isSectionInView = useInView(sectionRef, { once: true, amount: 0.1 });
  const isTitleInView = useInView(titleRef, { once: true, amount: 0.3 });
  const isGalleryInView = useInView(galleryRef, { once: true, amount: 0.1 });

  // Fetch gallery images from API - force fresh data
  const { data: galleryData, isLoading, error } = useQuery<{ images: ConfigImage[] }>({
    queryKey: ["/api/config-images/gallery"],
    staleTime: 0, // No cache - always fetch fresh data
    refetchOnWindowFocus: true,
  });

  // Use configurable images if available, otherwise fallback to constants
  const galleryImages = galleryData?.images?.length 
    ? galleryData.images.map(img => ({
        src: img.imageUrl,
        alt: img.title || img.description || "Gallery image"
      }))
    : GALLERY_PHOTOS;

  // Hide gallery section if no images are configured
  const hasConfiguredImages = galleryData?.images?.length > 0;
  const shouldShowGallery = hasConfiguredImages || (!galleryData && GALLERY_PHOTOS.length > 0);

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
    <section id="gallery" className="py-20 bg-background" ref={sectionRef}>
      <div className="container mx-auto px-4">
        <motion.div 
          className="text-center mb-16"
          ref={titleRef}
          variants={staggerContainer}
          initial="hidden"
          animate={isTitleInView ? "visible" : "hidden"}
        >
          <motion.h2 
            className="text-4xl font-cormorant text-foreground mb-4"
            variants={fadeIn}
          >
            Our Gallery
          </motion.h2>
          <motion.div 
            className="w-20 h-0.5 bg-accent mx-auto mb-6"
            variants={fadeIn}
          ></motion.div>
          <motion.p 
            className="text-muted-foreground font-montserrat max-w-2xl mx-auto"
            variants={fadeIn}
          >
            A glimpse into our journey together and the moments that led us here
          </motion.p>
        </motion.div>
        
        <motion.div 
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
          ref={galleryRef}
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
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
                className="overflow-hidden rounded-lg shadow-md cursor-pointer"
                variants={fadeIn}
                custom={index}
                transition={{ delay: index * 0.1 }}
                whileHover="hover"
                initial="initial"
                onClick={() => setSelectedImageIndex(index)}
                data-testid={`gallery-image-${index}`}
              >
                <motion.img 
                  src={photo.src} 
                  alt={photo.alt} 
                  className="w-full h-64 object-cover transition duration-300"
                  variants={scaleOnHover}
                  loading="lazy"
                  style={{
                    backgroundColor: '#f3f4f6',
                    minHeight: '256px'
                  }}
                  onLoad={(e) => {
                    const img = e.target as HTMLImageElement;
                    img.style.backgroundColor = 'transparent';
                  }}
                  onError={(e) => {
                    const img = e.target as HTMLImageElement;
                    img.style.backgroundColor = '#ef4444';
                    img.style.color = 'white';
                    img.alt = 'Failed to load image';
                  }}
                />
              </motion.div>
            ))
          )}
        </motion.div>
      </div>

      {/* Image Viewer Modal */}
      <Dialog open={selectedImageIndex !== null} onOpenChange={(open) => !open && setSelectedImageIndex(null)}>
        <DialogContent className="max-w-7xl w-full h-[90vh] p-0 bg-black/95 border-none">
          {selectedImageIndex !== null && (
            <div className="relative w-full h-full flex items-center justify-center">
              {/* Close button */}
              <button
                onClick={() => setSelectedImageIndex(null)}
                className="absolute top-4 right-4 z-50 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
                data-testid="close-image-viewer"
                aria-label="Close image viewer"
              >
                <X className="w-6 h-6" />
              </button>

              {/* Image counter */}
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-black/50 rounded-full text-white font-montserrat text-sm">
                {selectedImageIndex + 1} / {galleryImages.length}
              </div>

              {/* Previous button */}
              {galleryImages.length > 1 && (
                <button
                  onClick={handlePrevious}
                  className="absolute left-4 z-50 p-3 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
                  data-testid="previous-image"
                  aria-label="Previous image"
                >
                  <ChevronLeft className="w-8 h-8" />
                </button>
              )}

              {/* Full-size image */}
              <img
                src={galleryImages[selectedImageIndex].src}
                alt={galleryImages[selectedImageIndex].alt}
                className="max-w-full max-h-full object-contain"
                data-testid="fullsize-image"
              />

              {/* Next button */}
              {galleryImages.length > 1 && (
                <button
                  onClick={handleNext}
                  className="absolute right-4 z-50 p-3 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
                  data-testid="next-image"
                  aria-label="Next image"
                >
                  <ChevronRight className="w-8 h-8" />
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
