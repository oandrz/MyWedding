import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { BRIDE_NAME, GROOM_NAME, WEDDING_DATE } from "@/lib/constants";
import { fadeIn, floatAnimation, pulseAnimation } from "@/lib/animations";
import { useQuery } from "@tanstack/react-query";
import type { ConfigImage } from "@shared/schema";

const HeroSection = () => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [preloadedImage, setPreloadedImage] = useState<string | null>(null);
  
  // Format the wedding date
  const formattedDate = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  }).format(WEDDING_DATE);

  // Fetch banner image from API
  const { data: bannerData } = useQuery<{ images: ConfigImage[] }>({
    queryKey: ["/api/config-images/banner"],
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Get the banner image URL or fallback to default
  const bannerImageUrl = bannerData?.images?.[0]?.imageUrl || 
    "https://images.unsplash.com/photo-1469371670807-013ccf25f16a?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1920&q=80";

  // Preload the image to avoid glitches
  useEffect(() => {
    if (bannerImageUrl && bannerImageUrl !== preloadedImage) {
      const img = new Image();
      img.onload = () => {
        setPreloadedImage(bannerImageUrl);
        setImageLoaded(true);
      };
      img.src = bannerImageUrl;
    }
  }, [bannerImageUrl, preloadedImage]);
  
  // Use preloaded image or fallback
  const bannerImage = preloadedImage || bannerImageUrl;
  
  return (
    <section id="hero" className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
      <div 
        className={`absolute inset-0 bg-cover bg-center transition-opacity duration-500 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
        style={{ backgroundImage: `url('${bannerImage}')` }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-[#00000080] to-[#00000040]"></div>
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTYiIGhlaWdodD0iNTYiIHZpZXdCb3g9IjAgMCA1NiA1NiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMjggMEMzMi43ODY5IDAgMzcuNDI3MSAxLjQ5OTYgNDEuMzMzNCA0LjMwNjA2QzQ1LjIzOTcgNy4xMTI1MiA0OC4yMTQgMTEuMTE0IDQ5Ljg1MzQgMTUuNzA3N0M1MS40OTI3IDIwLjMwMTUgNTEuNzI2OSAyNS4yODM1IDUwLjUyMDMgMzAuMDE3QzQ5LjMxMzYgMzQuNzUwNSA0Ni43MjgzIDM4Ljk4NDggNDIuOTcwNiA0Mi4yMTc4QzM5LjIxMyA0NS40NTA4IDM0LjUxOTMgNDcuNTIwMyAyOS41NjIxIDQ4LjEzMDRDMjQuNjA0OSA0OC43NDA0IDE5LjU3NjMgNDcuODYyNiAxNS4xMzY2IDQ1LjU5NDlDMTAuNjk2OSA0My4zMjcyIDcuMDgwNyAzOS43ODc1IDQuNzk3MDIgMzUuNDU5MUMyLjUxMzM0IDMxLjEzMDYgMS42NTgyOSAyNi4xMSAyLjI5MTUyIDIxLjE1MzJDMi45MjQ3NiAxNi4xOTY0IDUuMDE4MTggMTEuNTAxMSA4LjI3MTEyIDcuNzQ2NjVDMTEuNTI0MSAzLjk5MjE3IDE1Ljc3MzQgMS40MTQ2OCAyMC41MTU5IDAuMjIxNjA0QzI1LjI1ODMgLTAuOTcxNDc3IDMwLjI0NDEgLTAuNzI1Mjc5IDM0LjgzNDcgMC45MjE2MzJWMEgyOFoiIGZpbGw9IndoaXRlIiBmaWxsLW9wYWNpdHk9IjAuMDMiLz48L3N2Zz4=')] opacity-20"></div>
      </div>
      
      {/* Fallback loading background */}
      {!imageLoaded && (
        <div className="absolute inset-0 bg-gray-800">
          <div className="absolute inset-0 bg-gradient-to-b from-[#00000080] to-[#00000040]"></div>
        </div>
      )}
      
      <motion.div 
        className="relative z-10 text-center px-4"
        initial="hidden"
        animate="visible"
        variants={fadeIn}
      >
        <motion.h3 
          className="text-xl md:text-2xl font-montserrat text-[#F9F5F0] uppercase tracking-widest mb-4"
          variants={floatAnimation}
          initial="hidden"
          animate={["visible", "float"]}
        >
          We're Getting Married
        </motion.h3>
        
        <motion.h1 
          className="text-5xl md:text-7xl font-cormorant font-light text-white mb-8"
          variants={fadeIn}
        >
          {BRIDE_NAME} & {GROOM_NAME}
        </motion.h1>
        
        <motion.div 
          className="flex items-center justify-center gap-4 mb-8"
          variants={fadeIn}
        >
          <div className="h-0.5 w-12 md:w-24 bg-accent"></div>
          <div className="text-white text-2xl">♥</div>
          <div className="h-0.5 w-12 md:w-24 bg-accent"></div>
        </motion.div>
        
        <motion.div 
          className="mb-12 border border-white/20 rounded-lg py-4 px-8 bg-black/10 inline-block mx-auto backdrop-blur-sm"
          variants={fadeIn}
        >
          <p className="text-xl md:text-2xl font-cormorant text-white">
            {formattedDate}
          </p>
          <div className="mt-1 text-sm text-white/80 font-montserrat uppercase tracking-wider">Save the Date</div>
        </motion.div>
        
        <motion.a 
          href="#rsvp" 
          className="custom-button inline-block px-8 py-3 bg-primary text-white font-montserrat uppercase tracking-wider text-sm hover:bg-opacity-90 hover:shadow-lg transition-all duration-300 rounded-sm border border-white/20"
          whileHover={{ scale: 1.05, boxShadow: "0 0 15px rgba(255,255,255,0.5)" }}
          whileTap={{ scale: 0.95 }}
          variants={fadeIn}
        >
          <span className="flex items-center gap-2">
            <span>RSVP Now</span>
            <span className="text-xs">♥</span>
          </span>
        </motion.a>
      </motion.div>
      
      <motion.div 
        className="absolute bottom-8 left-0 right-0 text-center"
        variants={pulseAnimation}
        initial="initial"
        animate="pulse"
      >
        <a href="#couple" className="text-white">
          <i className="fas fa-chevron-down"></i>
        </a>
      </motion.div>
    </section>
  );
};

export default HeroSection;
