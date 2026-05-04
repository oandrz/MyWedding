import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type { WelcomeScreen } from "@shared/schema";

// Petal configuration for floating animation
const PETALS = [
  { top: "8%", left: "12%", size: 14, rotate: -25, delay: 0, duration: 18, color: "rgba(219,169,169,0.10)" },
  { top: "15%", right: "18%", size: 11, rotate: 45, delay: 2, duration: 22, color: "rgba(219,169,169,0.08)" },
  { top: "55%", right: "8%", size: 9, rotate: -50, delay: 4, duration: 20, color: "rgba(212,175,55,0.06)" },
  { top: "40%", left: "6%", size: 12, rotate: 60, delay: 1, duration: 25, color: "rgba(219,169,169,0.09)" },
  { top: "70%", right: "15%", size: 10, rotate: 30, delay: 3, duration: 17, color: "rgba(219,169,169,0.07)" },
  { top: "25%", left: "80%", size: 8, rotate: -15, delay: 5, duration: 23, color: "rgba(212,175,55,0.05)" },
];

interface WelcomeOverlayProps {
  onDismiss?: () => void;
}

const WelcomeOverlay = ({ onDismiss }: WelcomeOverlayProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [guestName, setGuestName] = useState<string>("");
  const [location] = useLocation();

  const isAdminPage = location.includes('/admin');

  // Read URL params once on mount
  const [inviteCode, setInviteCode] = useState<string>("");

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get("code");
      if (code) setInviteCode(code);
    }
  }, []);

  // Fetch welcome screen configuration
  const { data } = useQuery<{ welcomeScreen: WelcomeScreen }>({
    queryKey: ["/api/welcome-screen"],
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
    enabled: !isAdminPage,
  });

  // Fetch invite details when code param is present
  const { data: inviteData } = useQuery<{ invite: { name: string } }>({
    queryKey: ["/api/invites", inviteCode],
    queryFn: async () => {
      const response = await fetch(`/api/invites/${encodeURIComponent(inviteCode)}`);
      if (!response.ok) throw new Error("Invalid invite code");
      return response.json();
    },
    enabled: !!inviteCode,
    staleTime: 10 * 60 * 1000,
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
      // Extract guest name from URL parameter or invite data
      const urlParams = new URLSearchParams(window.location.search);
      const toParam = urlParams.get("to");

      if (inviteData?.invite?.name) {
        setGuestName(inviteData.invite.name);
      } else if (toParam) {
        setGuestName(decodeURIComponent(toParam));
      } else {
        setGuestName(welcomeScreen.fallbackName);
      }

      // If we have a code but invite hasn't loaded yet, wait
      if (inviteCode && !inviteData) {
        return;
      }

      setIsOpen(true);

      // Lock body scroll while overlay is open
      document.body.style.overflow = "hidden";
    }
  }, [welcomeScreen, isAdminPage, inviteData, inviteCode]);

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

    onDismiss?.();
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
          className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
          style={{ background: "linear-gradient(180deg, #FDFBF7 0%, #faf5f0 50%, #FDFBF7 100%)" }}
          data-testid="welcome-overlay"
        >
          {/* Watercolor blobs */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1 }}
            className="absolute inset-0 pointer-events-none"
          >
            <div
              className="absolute animate-[blob-pulse_4s_ease-in-out_infinite]"
              style={{
                top: "-40px",
                right: "-60px",
                width: "300px",
                height: "300px",
                background: "radial-gradient(circle, rgba(219,169,169,0.06) 0%, transparent 70%)",
                borderRadius: "50%",
              }}
            />
            <div
              className="absolute animate-[blob-pulse_5s_ease-in-out_infinite_1s]"
              style={{
                bottom: "-40px",
                left: "-40px",
                width: "240px",
                height: "240px",
                background: "radial-gradient(circle, rgba(219,169,169,0.05) 0%, transparent 70%)",
                borderRadius: "50%",
              }}
            />
            <div
              className="absolute animate-[blob-pulse_4.5s_ease-in-out_infinite_0.5s]"
              style={{
                top: "40%",
                left: "-20px",
                width: "160px",
                height: "160px",
                background: "radial-gradient(circle, rgba(212,175,55,0.04) 0%, transparent 70%)",
                borderRadius: "50%",
              }}
            />
          </motion.div>

          {/* Corner frame */}
          {[
            { pos: "top-6 left-6", border: "border-t border-l" },
            { pos: "top-6 right-6", border: "border-t border-r" },
            { pos: "bottom-6 left-6", border: "border-b border-l" },
            { pos: "bottom-6 right-6", border: "border-b border-r" },
          ].map((corner, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 + i * 0.15, duration: 0.6, ease: "easeOut" }}
              className={`absolute ${corner.pos} w-8 h-8 sm:w-10 sm:h-10 ${corner.border} pointer-events-none`}
              style={{ borderColor: "rgba(219,169,169,0.25)" }}
            />
          ))}

          {/* Floating petals */}
          {PETALS.map((petal, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.5 + petal.delay * 0.2, duration: 0.8 }}
              className="absolute pointer-events-none"
              style={{
                top: petal.top,
                left: petal.left,
                right: (petal as { right?: string }).right,
                width: `${petal.size * 0.7}px`,
                height: `${petal.size}px`,
                background: petal.color,
                borderRadius: "50% 0 50% 50%",
                transform: `rotate(${petal.rotate}deg)`,
                animation: `petal-float-${i} ${petal.duration}s ease-in-out infinite`,
                willChange: "transform",
              }}
            />
          ))}

          {/* Main content */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6, ease: "easeOut" }}
            className="text-center px-6 max-w-2xl py-8 sm:py-0 relative z-10"
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

            {/* Enhanced Decorative Divider */}
            <motion.div
              initial={{ opacity: 0, scaleX: 0 }}
              animate={{ opacity: 1, scaleX: 1 }}
              transition={{ delay: 0.6, duration: 0.6, ease: "easeOut" }}
              className="flex items-center justify-center gap-2 mb-6 sm:mb-12"
            >
              <div
                className="h-px w-8 sm:w-12"
                style={{ background: "linear-gradient(90deg, transparent, rgba(219,169,169,0.4))" }}
              />
              <div
                className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full"
                style={{ background: "rgba(219,169,169,0.35)" }}
              />
              <div
                className="h-px w-8 sm:w-12"
                style={{ background: "linear-gradient(90deg, rgba(219,169,169,0.4), transparent)" }}
              />
            </motion.div>

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

            {/* Enhanced Button with shimmer */}
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 1.2, duration: 0.5 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleOpen}
              className="relative font-montserrat text-xs sm:text-sm md:text-base uppercase tracking-wide px-8 sm:px-10 py-3 sm:py-4 rounded-full text-white overflow-hidden transition-all duration-300"
              style={{
                background: "linear-gradient(135deg, #dba9a9, #c99595)",
                boxShadow: "0 4px 15px rgba(219,169,169,0.25)",
              }}
              data-testid="button-open-invitation"
            >
              <span className="relative z-10">Open Invitation</span>
              {/* Shimmer sweep */}
              <div
                className="absolute inset-0 animate-[shimmer_3s_ease-in-out_infinite_1.5s]"
                style={{
                  background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.2) 50%, transparent 60%)",
                  transform: "translateX(-100%)",
                }}
              />
            </motion.button>
          </motion.div>

          {/* Keyframe definitions */}
          <style>{`
            @keyframes blob-pulse {
              0%, 100% { transform: scale(1); }
              50% { transform: scale(1.15); }
            }
            @keyframes shimmer {
              0% { transform: translateX(-100%); }
              50%, 100% { transform: translateX(100%); }
            }
            ${PETALS.map((petal, i) => `
              @keyframes petal-float-${i} {
                0%, 100% {
                  transform: rotate(${petal.rotate}deg) translate(0, 0);
                }
                25% {
                  transform: rotate(${petal.rotate + 10}deg) translate(${i % 2 === 0 ? 8 : -8}px, ${10 + i * 2}px);
                }
                50% {
                  transform: rotate(${petal.rotate - 5}deg) translate(${i % 2 === 0 ? -5 : 5}px, ${20 + i * 3}px);
                }
                75% {
                  transform: rotate(${petal.rotate + 8}deg) translate(${i % 2 === 0 ? 6 : -6}px, ${10 + i}px);
                }
              }
            `).join("")}
          `}</style>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default WelcomeOverlay;
