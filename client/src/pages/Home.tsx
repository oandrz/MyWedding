import NavBar from "@/components/NavBar";
import HeroSection from "@/components/HeroSection";
import CoupleSection from "@/components/CoupleSection";
import DetailsSection from "@/components/DetailsSection";
import GallerySection from "@/components/GallerySection";
import RsvpSection from "@/components/RsvpSection";
import Footer from "@/components/Footer";
import { useGalleryEnabled, useRsvpEnabled } from "@/hooks/useFeatureFlags";

export default function Home() {
  const isGalleryEnabled = useGalleryEnabled();
  const isRsvpEnabled = useRsvpEnabled();

  return (
    <div className="overflow-hidden">
      <NavBar />
      <HeroSection />
      <CoupleSection />
      {/* Floral Divider */}
      <div className="floral-divider w-full"></div>
      <DetailsSection />
      {/* Floral Divider */}
      <div className="floral-divider w-full"></div>
      {isGalleryEnabled && <GallerySection />}
      {isRsvpEnabled && <RsvpSection />}
      <Footer />
    </div>
  );
}
