import NavBar from "@/components/NavBar";
import HeroSection from "@/components/HeroSection";
import CountdownSection from "@/components/CountdownSection";
import CoupleSection from "@/components/CoupleSection";
import DetailsSection from "@/components/DetailsSection";
import GallerySection from "@/components/GallerySection";
import RsvpSection from "@/components/RsvpSection";
import Footer from "@/components/Footer";

import { Link } from "wouter";
import { Palette } from "lucide-react";

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
      <Footer />
      
      {/* Floating Template Button */}
      <Link href="/templates">
        <div className="fixed bottom-6 right-6 z-40 group">
          <button className="bg-rose-500 hover:bg-rose-600 text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 group-hover:scale-110">
            <Palette className="h-6 w-6" />
          </button>
          <div className="absolute bottom-full right-0 mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
            <div className="bg-gray-900 text-white text-sm px-3 py-2 rounded-lg whitespace-nowrap">
              Change Theme
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}
