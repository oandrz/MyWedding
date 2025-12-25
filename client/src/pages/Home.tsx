import NavBar from "@/components/NavBar";
import HeroSection from "@/components/HeroSection";
import BibleVerseSection from "@/components/BibleVerseSection";
import CoupleSection from "@/components/CoupleSection";
import DetailsSection from "@/components/DetailsSection";
import GallerySection from "@/components/GallerySection";
import RsvpSection from "@/components/RsvpSection";
import EGiftSection from "@/components/EGiftSection";
import Footer from "@/components/Footer";
import { useGalleryEnabled, useRsvpEnabled, useEGiftEnabled } from "@/hooks/useFeatureFlags";
import { useImagePreloader } from "@/hooks/useImagePreloader";

export default function Home() {
  const isGalleryEnabled = useGalleryEnabled();
  const isRsvpEnabled = useRsvpEnabled();
  const isEGiftEnabled = useEGiftEnabled();
  
  useImagePreloader();

  return (
    <div className="overflow-hidden">
      <NavBar />
      <HeroSection />
      <BibleVerseSection />
      <CoupleSection />
      {/* Floral Divider */}
      <div className="floral-divider w-full"></div>
      <DetailsSection />
      {/* Floral Divider */}
      <div className="floral-divider w-full"></div>
      {isGalleryEnabled && <GallerySection />}
      {isEGiftEnabled && <EGiftSection />}
      {isRsvpEnabled && <RsvpSection />}
      <Footer />
    </div>
  );
}
