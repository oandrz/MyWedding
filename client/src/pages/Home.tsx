import NavBar from "@/components/NavBar";
import HeroSection from "@/components/HeroSection";
import CountdownSection from "@/components/CountdownSection";
import CoupleSection from "@/components/CoupleSection";
import DetailsSection from "@/components/DetailsSection";
import GallerySection from "@/components/GallerySection";
import RsvpSection from "@/components/RsvpSection";
import MessageWallSection from "@/components/MessageWallSection";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <div className="overflow-hidden">
      <NavBar />
      <HeroSection />
      <CountdownSection />
      <CoupleSection />
      {/* Floral Divider */}
      <div className="floral-divider w-full"></div>
      <DetailsSection />
      {/* Floral Divider */}
      <div className="floral-divider w-full"></div>
      <GallerySection />
      <RsvpSection />
      {/* Floral Divider */}
      <div className="floral-divider w-full"></div>
      <MessageWallSection />
      <Footer />
    </div>
  );
}
