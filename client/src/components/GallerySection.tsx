import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { GALLERY_PHOTOS } from "@/lib/constants";
import { fadeIn, staggerContainer, scaleOnHover } from "@/lib/animations";
import { useQuery } from "@tanstack/react-query";
import type { ConfigImage } from "@shared/schema";

const GallerySection = () => {
  const sectionRef = useRef(null);
  const titleRef = useRef(null);
  const galleryRef = useRef(null);
  
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
                className="overflow-hidden rounded-lg shadow-md"
                variants={fadeIn}
                custom={index}
                transition={{ delay: index * 0.1 }}
                whileHover="hover"
                initial="initial"
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
    </section>
  );
};

export default GallerySection;
