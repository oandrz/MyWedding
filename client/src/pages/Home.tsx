import NavBar from "@/components/NavBar";
import HeroSection from "@/components/HeroSection";
import CountdownSection from "@/components/CountdownSection";
import CoupleSection from "@/components/CoupleSection";
import DetailsSection from "@/components/DetailsSection";
import GallerySection from "@/components/GallerySection";
import RsvpSection from "@/components/RsvpSection";
import Footer from "@/components/Footer";
import { useCountdownEnabled, useGalleryEnabled, useRsvpEnabled } from "@/hooks/useFeatureFlags";

export default function Home() {
  const isCountdownEnabled = useCountdownEnabled();
  const isGalleryEnabled = useGalleryEnabled();
  const isRsvpEnabled = useRsvpEnabled();

  return (
    <div className="overflow-hidden">
      <NavBar />
      <HeroSection />
      {isCountdownEnabled && <CountdownSection />}
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
