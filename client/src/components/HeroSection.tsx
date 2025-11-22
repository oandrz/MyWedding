import { motion } from "framer-motion";
import { useState, useEffect, useRef, useMemo } from "react";
import { BRIDE_NAME, GROOM_NAME, WEDDING_DATE } from "@/lib/constants";
import { fadeIn, floatAnimation, pulseAnimation } from "@/lib/animations";
import { useQuery } from "@tanstack/react-query";
import type { ConfigImage } from "@shared/schema";

// Custom hook for parallax scrolling effect
const useParallax = (speed: number = 0.5) => {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      setOffset(window.pageYOffset);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return offset * speed;
};

const BANNER_CACHE_KEY = "wedding_banner_cache";
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

interface BannerCache {
  url: string;
  timestamp: number;
}

// Helper: Save banner to localStorage cache
const setCachedBanner = (url: string): void => {
  try {
    const data: BannerCache = {
      url,
      timestamp: Date.now()
    };
    localStorage.setItem(BANNER_CACHE_KEY, JSON.stringify(data));
  } catch (error) {
    // Silently fail if localStorage is unavailable
  }
};

type HeroStatus = 'idle' | 'cached' | 'loading' | 'ready';

interface HeroState {
  status: HeroStatus;
  url?: string;
}

const HeroSection = () => {
  const [heroState, setHeroState] = useState<HeroState>({ status: 'idle' });
  const activeUrlRef = useRef<string | null>(null);
  const parallaxOffset = useParallax(0.5); // Parallax speed factor
  
  // Format the wedding date
  const formattedDate = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  }).format(WEDDING_DATE);

  // Fetch banner image from API - force fresh data
  const { data: bannerData } = useQuery<{ images: ConfigImage[] }>({
    queryKey: ["/api/config-images/banner"],
    staleTime: 0, // No cache - always fetch fresh data
    refetchOnWindowFocus: true,
  });

  // Extract API image URL (null if no custom banner uploaded)
  const apiImageUrl = bannerData?.images?.[0]?.imageUrl ?? null;
  
  // Fallback URL - only used if API returns no custom banner
  const FALLBACK_URL = "https://images.unsplash.com/photo-1469371670807-013ccf25f16a?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1920&q=80";

  // Effect 1: Mount-only cache hydration
  useEffect(() => {
    try {
      const cached = localStorage.getItem(BANNER_CACHE_KEY);
      if (!cached) return;
      
      const data: BannerCache = JSON.parse(cached);
      const age = Date.now() - data.timestamp;
      
      // Check if cache is still valid
      if (age < CACHE_EXPIRY_MS) {
        // Preload cached image
        const img = new Image();
        img.onload = () => {
          // Only set ref and state if image successfully loads
          activeUrlRef.current = data.url;
          setHeroState({ status: 'cached', url: data.url });
        };
        img.onerror = () => {
          // Clear failed cache so fallback can load
          localStorage.removeItem(BANNER_CACHE_KEY);
          activeUrlRef.current = null;
        };
        img.src = data.url;
      } else {
        // Clear expired cache
        localStorage.removeItem(BANNER_CACHE_KEY);
      }
    } catch (error) {
      // Clear malformed cache
      localStorage.removeItem(BANNER_CACHE_KEY);
    }
  }, []); // Run once on mount

  // Detect if API returned a different URL than what's cached/active
  const pendingUrl = useMemo(() => {
    // Only process custom banners from API (not fallback)
    if (apiImageUrl && apiImageUrl !== activeUrlRef.current) {
      return apiImageUrl;
    }
    
    return null;
  }, [apiImageUrl]);

  // Effect 2: Preload pipeline when new URL detected
  useEffect(() => {
    if (!pendingUrl) return;
    
    // Start loading new image
    setHeroState(prev => ({ ...prev, status: 'loading' }));
    
    let isCurrent = true;
    const img = new Image();
    
    img.onload = () => {
      if (isCurrent) {
        activeUrlRef.current = pendingUrl;
        setHeroState({ status: 'ready', url: pendingUrl });
        setCachedBanner(pendingUrl);
      }
    };
    
    img.onerror = () => {
      if (isCurrent) {
        // Keep current state on error
        setHeroState(prev => ({ ...prev, status: 'ready' }));
      }
    };
    
    img.src = pendingUrl;
    
    return () => {
      isCurrent = false;
    };
  }, [pendingUrl]);
  
  // Determine which image to show
  // Priority: cached/loaded custom banner > fallback (only if API returned no images)
  const bannerImage = heroState.url || (bannerData && !apiImageUrl ? FALLBACK_URL : "");
  // Show banner if: we have a cached/loaded URL, OR if API returned no custom banner (show fallback)
  const showBanner = heroState.url || (bannerData && !apiImageUrl);
  
  return (
    <section id="hero" className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
      <div 
        className={`absolute inset-0 bg-cover transition-opacity duration-500 ${showBanner ? 'opacity-100' : 'opacity-0'}`}
        style={{ 
          backgroundImage: `url('${bannerImage}')`,
          backgroundPosition: '50% 30%',
          transform: `translateY(${parallaxOffset}px)`,
          willChange: 'transform'
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-[#00000080] to-[#00000040]"></div>
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTYiIGhlaWdodD0iNTYiIHZpZXdCb3g9IjAgMCA1NiA1NiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMjggMEMzMi43ODY5IDAgMzcuNDI3MSAxLjQ5OTYgNDEuMzMzNCA0LjMwNjA2QzQ1LjIzOTcgNy4xMTI1MiA0OC4yMTQgMTEuMTE0IDQ5Ljg1MzQgMTUuNzA3N0M1MS40OTI3IDIwLjMwMTUgNTEuNzI2OSAyNS4yODM1IDUwLjUyMDMgMzAuMDE3QzQ5LjMxMzYgMzQuNzUwNSA0Ni43MjgzIDM4Ljk4NDggNDIuOTcwNiA0Mi4yMTc4QzM5LjIxMyA0NS40NTA4IDM0LjUxOTMgNDcuNTIwMyAyOS41NjIxIDQ4LjEzMDRDMjQuNjA0OSA0OC43NDA0IDE5LjU3NjMgNDcuODYyNiAxNS4xMzY2IDQ1LjU5NDlDMTAuNjk2OSA0My4zMjcyIDcuMDgwNyAzOS43ODc1IDQuNzk3MDIgMzUuNDU5MUMyLjUxMzM0IDMxLjEzMDYgMS42NTgyOSAyNi4xMSAyLjI5MTUyIDIxLjE1MzJDMi45MjQ3NiAxNi4xOTY0IDUuMDE4MTggMTEuNTAxMSA4LjI3MTEyIDcuNzQ2NjVDMTEuNTI0MSAzLjk5MjE3IDE1Ljc3MzQgMS40MTQ2OCAyMC41MTU5IDAuMjIxNjA0QzI1LjI1ODMgLTAuOTcxNDc3IDMwLjI0NDEgLTAuNzI1Mjc5IDM0LjgzNDcgMC45MjE2MzJWMEgyOFoiIGZpbGw9IndoaXRlIiBmaWxsLW9wYWNpdHk9IjAuMDMiLz48L3N2Zz4=')] opacity-20"></div>
      </div>
      
      {/* Fallback loading background */}
      {!showBanner && (
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
          {GROOM_NAME} & {BRIDE_NAME}
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
