import NavBar from "@/components/NavBar";
import HeroSection from "@/components/HeroSection";
import BibleVerseSection from "@/components/BibleVerseSection";
import CoupleSection from "@/components/CoupleSection";
import DetailsSection from "@/components/DetailsSection";
import GallerySection from "@/components/GallerySection";
import RsvpSection from "@/components/RsvpSection";
import MessagesSection from "@/components/MessagesSection";
import EGiftSection from "@/components/EGiftSection";
import Footer from "@/components/Footer";
import { useGalleryEnabled, useRsvpEnabled, useEGiftEnabled, useMessagesEnabled } from "@/hooks/useFeatureFlags";
import { useImagePreloader } from "@/hooks/useImagePreloader";

export default function Home() {
  const isGalleryEnabled = useGalleryEnabled();
  const isRsvpEnabled = useRsvpEnabled();
  const isEGiftEnabled = useEGiftEnabled();
  const isMessagesEnabled = useMessagesEnabled();

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
      {/* Floral Divider */}
      {isEGiftEnabled && <div className="floral-divider w-full"></div>}
      {isEGiftEnabled && <EGiftSection />}
      {/* Floral Divider */}
      {(isEGiftEnabled || isGalleryEnabled) && <div className="floral-divider w-full"></div>}
      {isRsvpEnabled && <RsvpSection />}
      {/* Floral Divider */}
      {isMessagesEnabled && <div className="floral-divider w-full"></div>}
      {isMessagesEnabled && <MessagesSection />}
      <Footer />
    </div>
  );
}
