import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type { WelcomeScreen } from "@shared/schema";

const WelcomeOverlay = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [guestName, setGuestName] = useState<string>("");
  const [location] = useLocation();

  const isAdminPage = location.includes('/admin');

  // Fetch welcome screen configuration
  const { data } = useQuery<{ welcomeScreen: WelcomeScreen }>({
    queryKey: ["/api/welcome-screen"],
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
    enabled: !isAdminPage,
  });

  const welcomeScreen = data?.welcomeScreen;

  useEffect(() => {
    if (isAdminPage) {
      return;
    }

    // Only run in browser environment
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    // Check if overlay has already been opened in this session
    const hasOpenedOverlay = sessionStorage.getItem("welcome_overlay_opened");
    
    if (hasOpenedOverlay) {
      return;
    }

    // Only show overlay if it's enabled
    if (welcomeScreen && welcomeScreen.enabled) {
      // Extract guest name from URL parameter
      const urlParams = new URLSearchParams(window.location.search);
      const toParam = urlParams.get("to");
      
      if (toParam) {
        setGuestName(decodeURIComponent(toParam));
      } else {
        setGuestName(welcomeScreen.fallbackName);
      }

      setIsOpen(true);
      
      // Lock body scroll while overlay is open
      document.body.style.overflow = "hidden";
    }
  }, [welcomeScreen, isAdminPage]);

  const handleOpen = () => {
    setIsOpen(false);
    
    // Unlock body scroll (with browser check)
    if (typeof document !== 'undefined') {
      document.body.style.overflow = "";
    }
    
    // Mark as opened in session storage (with browser check)
    if (typeof window !== 'undefined') {
      sessionStorage.setItem("welcome_overlay_opened", "true");
    }
  };

  if (isAdminPage || !welcomeScreen || !welcomeScreen.enabled) {
    return null;
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, y: -50 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#FDFBF7] overflow-hidden"
          data-testid="welcome-overlay"
        >
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6, ease: "easeOut" }}
            className="text-center px-6 max-w-2xl py-8 sm:py-0"
          >
            {/* Main Heading */}
            <motion.h1
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.8 }}
              className="font-cormorant text-3xl sm:text-5xl md:text-6xl lg:text-7xl text-foreground mb-4 sm:mb-8"
            >
              {welcomeScreen.headingText}
            </motion.h1>

            {/* Decorative Line */}
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.6, duration: 0.6, ease: "easeOut" }}
              className="w-24 h-0.5 metallic-rose mx-auto mb-6 sm:mb-12"
            />

            {/* Delivery Label */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8, duration: 0.6 }}
              className="font-montserrat text-[10px] sm:text-xs md:text-sm uppercase tracking-[0.3em] text-muted-foreground mb-3 sm:mb-4"
            >
              {welcomeScreen.deliveryLabel}
            </motion.p>

            {/* Guest Name */}
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1, duration: 0.6 }}
              className="font-cormorant text-3xl sm:text-4xl md:text-5xl italic text-primary mb-8 sm:mb-16"
            >
              {guestName}
            </motion.h2>

            {/* Open Button */}
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 1.2, duration: 0.5 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleOpen}
              className="bg-primary text-white font-montserrat text-xs sm:text-sm md:text-base uppercase tracking-wide px-8 sm:px-10 py-3 sm:py-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-300"
              data-testid="button-open-invitation"
            >
              Open Invitation
            </motion.button>
          </motion.div>

          {/* Subtle Background Pattern (optional) */}
          <div className="absolute inset-0 opacity-5 pointer-events-none">
            <svg width="100%" height="100%">
              <pattern id="welcome-pattern" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                <circle cx="20" cy="20" r="1" fill="currentColor" className="text-primary" />
              </pattern>
              <rect width="100%" height="100%" fill="url(#welcome-pattern)" />
            </svg>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default WelcomeOverlay;
