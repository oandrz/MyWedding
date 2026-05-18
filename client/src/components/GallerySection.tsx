import { motion, useInView } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { useRef, useState, useEffect, useCallback, Component, type ReactNode } from "react";
import { GALLERY_PHOTOS } from "@/lib/constants";
import { fadeIn, staggerContainer, revealText } from "@/lib/animations";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ConfigImage } from "@shared/schema";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { ChevronLeft, ChevronRight, X, Camera } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
  type CarouselApi,
} from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";

const DEFAULT_CAROUSEL_INTERVAL = 4000;

// Helper: Generate responsive Unsplash URLs with optimized sizing
const getResponsiveImageUrl = (baseUrl: string, width: number, quality: number = 75): string => {
  if (!baseUrl.includes('unsplash.com')) return baseUrl;
  const url = new URL(baseUrl);
  url.searchParams.set('w', width.toString());
  url.searchParams.set('q', quality.toString());
  url.searchParams.set('auto', 'format');
  url.searchParams.set('fit', 'crop');
  return url.toString();
};

// Optimized Image Component
const OptimizedImage = ({ thumbnail, alt, index }: { thumbnail: string; alt: string; index: number }) => {
  const safeThumb = thumbnail || '';
  const optimizedSrc = safeThumb.includes('unsplash.com')
    ? getResponsiveImageUrl(safeThumb, 600, 70)
    : safeThumb;

  return (
    <div className="relative w-full bg-gray-100 overflow-hidden rounded-xl aspect-[2/3]">
      <img
        src={optimizedSrc}
        alt={alt}
        className="w-full h-full object-cover"
        loading={index < 4 ? "eager" : "lazy"}
        decoding="async"
      />
    </div>
  );
};

// Error fallback UI
const GalleryErrorFallback = ({ onRetry }: { onRetry: () => void }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <Camera className="h-12 w-12 text-gray-300 mb-4" />
    <p className="text-gray-500 text-lg mb-2">Gallery photos couldn't be loaded</p>
    <p className="text-gray-400 text-sm mb-4">Please try again later</p>
    <button
      onClick={onRetry}
      className="px-6 py-2 rounded-full text-white font-montserrat text-sm shadow-md hover:shadow-lg transition-all hover:brightness-110"
      style={{ backgroundColor: '#dba9a9' }}
    >
      Try Again
    </button>
  </div>
);

class GalleryErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

// Dot indicator component
const CarouselDots = ({ count, activeIndex }: { count: number; activeIndex: number }) => (
  <div className="flex justify-center gap-2 mt-6">
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        className="w-2 h-2 rounded-full transition-colors duration-300"
        style={{ backgroundColor: i === activeIndex ? '#dba9a9' : '#e8cece' }}
        data-testid={`carousel-dot-${i}`}
      />
    ))}
  </div>
);

const GallerySection = () => {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const sectionRef = useRef(null);
  const titleRef = useRef(null);
  const galleryRef = useRef(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [currentSlide, setCurrentSlide] = useState(0);

  const isSectionInView = useInView(sectionRef, { once: true, amount: 0.1 });
  const isTitleInView = useInView(titleRef, { once: true, amount: 0.3 });
  const isGalleryInView = useInView(galleryRef, { once: true, amount: 0.1 });

  // Fetch gallery images from API
  const { data: galleryData, isLoading, error } = useQuery<{ images: ConfigImage[] }>({
    queryKey: ["/api/config-images/gallery"],
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
    retryDelay: 1000,
    placeholderData: { images: [] },
  });

  // Fetch app settings for carousel interval
  const { data: settingsData } = useQuery<{ settings: any[] }>({
    queryKey: ["/api/app-settings"],
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const carouselInterval = (() => {
    const setting = settingsData?.settings?.find(
      (s: any) => s.settingKey === "gallery_carousel_interval"
    );
    const parsed = parseInt(setting?.settingValue, 10);
    return isNaN(parsed) || parsed < 2000 || parsed > 10000
      ? DEFAULT_CAROUSEL_INTERVAL
      : parsed;
  })();

  // Use configurable images if available, otherwise fallback to constants
  const galleryImages = galleryData?.images && galleryData.images.length > 0
    ? galleryData.images.map(img => ({
      src: img.imageUrl,
      thumbnail: (img as any).thumbnailUrl || img.imageUrl,
      alt: img.title || img.description || "Gallery image"
    }))
    : GALLERY_PHOTOS.map(p => ({ ...p, thumbnail: p.src }));

  const shouldShowGallery = galleryImages.length > 0;

  // Track current slide for dot indicator
  const onSelect = useCallback(() => {
    if (!carouselApi) return;
    setCurrentSlide(carouselApi.selectedScrollSnap() % galleryImages.length);
  }, [carouselApi, galleryImages.length]);

  useEffect(() => {
    if (!carouselApi) return;
    onSelect();
    carouselApi.on("select", onSelect);
    return () => { carouselApi.off("select", onSelect); };
  }, [carouselApi, onSelect]);

  // Fullscreen viewer keyboard navigation
  useEffect(() => {
    if (selectedImageIndex === null) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') handlePrevious();
      else if (e.key === 'ArrowRight') handleNext();
      else if (e.key === 'Escape') setSelectedImageIndex(null);
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

  if (!shouldShowGallery) return null;

  if (error) {
    return (
      <section id="gallery" className="py-20 bg-gradient-to-b from-white via-rose-50/30 to-white paper-texture" ref={sectionRef}>
        <div className="container mx-auto px-4">
          <GalleryErrorFallback onRetry={() => queryClient.invalidateQueries({ queryKey: ["/api/config-images/gallery"] })} />
        </div>
      </section>
    );
  }

  return (
    <GalleryErrorBoundary
      fallback={
        <section id="gallery" className="py-20 bg-gradient-to-b from-white via-rose-50/30 to-white paper-texture">
          <div className="container mx-auto px-4">
            <GalleryErrorFallback onRetry={() => window.location.reload()} />
          </div>
        </section>
      }
    >
      <section id="gallery" className="py-20 bg-gradient-to-b from-white via-rose-50/30 to-white paper-texture" ref={sectionRef}>
        <div className="container mx-auto px-4">
          {/* Title */}
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
              {t("ourGallery")}
            </motion.h2>
            <motion.div
              className="w-24 h-1 metallic-rose mx-auto rounded-full mb-6"
              variants={fadeIn}
            />
            <motion.p
              className="text-muted-foreground font-montserrat text-lg max-w-2xl mx-auto"
              variants={fadeIn}
            >
              {t("gallerySubtitle")}
            </motion.p>
          </motion.div>

          {/* Carousel */}
          <motion.div
            ref={galleryRef}
            initial="hidden"
            animate={isGalleryInView ? "visible" : "hidden"}
            variants={fadeIn}
          >
            {isLoading ? (
              <div className="flex gap-4 justify-center">
                <div className="aspect-[2/3] bg-gray-200 animate-pulse rounded-xl w-[85%] sm:w-[48%] lg:w-[31%]" />
                <div className="aspect-[2/3] bg-gray-200 animate-pulse rounded-xl hidden sm:block sm:w-[48%] lg:w-[31%]" />
                <div className="aspect-[2/3] bg-gray-200 animate-pulse rounded-xl hidden lg:block lg:w-[31%]" />
              </div>
            ) : (
              <>
                <Carousel
                  opts={{ loop: true, align: "start" }}
                  plugins={[
                    Autoplay({
                      delay: carouselInterval,
                      stopOnInteraction: false,
                      stopOnMouseEnter: true,
                    }),
                  ]}
                  setApi={setCarouselApi}
                  className="w-full"
                  data-testid="gallery-carousel"
                >
                  <CarouselContent>
                    {galleryImages.map((photo, index) => (
                      <CarouselItem
                        key={index}
                        className="basis-[85%] sm:basis-[48%] lg:basis-[31%]"
                        data-testid={`gallery-image-${index}`}
                      >
                        <div
                          className="overflow-hidden rounded-xl shadow-lg cursor-pointer ring-2 ring-transparent hover:ring-primary/30 transition-all"
                          onClick={() => setSelectedImageIndex(index)}
                        >
                          <OptimizedImage
                            thumbnail={photo.thumbnail}
                            alt={photo.alt}
                            index={index}
                          />
                        </div>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  <CarouselPrevious className="hidden sm:flex -left-4 lg:-left-12 bg-white/80 hover:bg-white border-none shadow-md" />
                  <CarouselNext className="hidden sm:flex -right-4 lg:-right-12 bg-white/80 hover:bg-white border-none shadow-md" />
                </Carousel>
                <CarouselDots count={galleryImages.length} activeIndex={currentSlide} />
              </>
            )}
          </motion.div>
        </div>

        {/* Fullscreen Image Viewer */}
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
                <button
                  onClick={() => setSelectedImageIndex(null)}
                  className="fixed top-2 right-2 md:top-4 md:right-4 z-[60] p-2 md:p-3 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors touch-manipulation"
                  data-testid="close-image-viewer"
                  aria-label="Close image viewer"
                >
                  <X className="w-5 h-5 md:w-6 md:h-6" />
                </button>
                <div className="fixed top-2 left-1/2 -translate-x-1/2 md:top-4 z-[60] px-3 py-1.5 md:px-4 md:py-2 bg-black/50 rounded-full text-white font-montserrat text-xs md:text-sm">
                  {selectedImageIndex + 1} / {galleryImages.length}
                </div>
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
                <div className="flex items-center justify-center w-full h-full">
                  <img
                    src={galleryImages[selectedImageIndex].src}
                    alt={galleryImages[selectedImageIndex].alt}
                    className="max-w-[calc(100vw-80px)] max-h-[calc(100vh-80px)] md:max-w-[calc(100vw-120px)] md:max-h-[calc(100vh-120px)] w-auto h-auto object-contain"
                    data-testid="fullsize-image"
                  />
                </div>
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
    </GalleryErrorBoundary>
  );
};

export default GallerySection;
