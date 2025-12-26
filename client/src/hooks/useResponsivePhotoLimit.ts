import { useState, useEffect } from "react";

/**
 * Responsive breakpoints for photo limits in the gallery
 * - Mobile (< 640px): Show 6 photos initially
 * - Small tablet (640-767px): Show 8 photos initially  
 * - Tablet (768-1023px): Show 12 photos initially
 * - Desktop (≥ 1024px): Show all photos (no pagination)
 */
interface PhotoLimitConfig {
    limit: number;
    batchSize: number;
    isDesktop: boolean;
}

const BREAKPOINTS = {
    MOBILE: 640,
    TABLET_SM: 768,
    TABLET: 1024,
} as const;

const LIMITS = {
    MOBILE: { limit: 6, batchSize: 6 },
    TABLET_SM: { limit: 8, batchSize: 8 },
    TABLET: { limit: 12, batchSize: 12 },
    DESKTOP: { limit: Infinity, batchSize: 0 },
} as const;

function getPhotoLimitConfig(width: number): PhotoLimitConfig {
    if (width < BREAKPOINTS.MOBILE) {
        return { ...LIMITS.MOBILE, isDesktop: false };
    } else if (width < BREAKPOINTS.TABLET_SM) {
        return { ...LIMITS.TABLET_SM, isDesktop: false };
    } else if (width < BREAKPOINTS.TABLET) {
        return { ...LIMITS.TABLET, isDesktop: false };
    } else {
        return { ...LIMITS.DESKTOP, isDesktop: true };
    }
}

/**
 * Hook that returns responsive photo limits based on screen width.
 * SSR-safe with desktop defaults (shows all photos on server render).
 */
export function useResponsivePhotoLimit(): PhotoLimitConfig {
    // Default to desktop (show all) for SSR and initial render
    const [config, setConfig] = useState<PhotoLimitConfig>({
        limit: Infinity,
        batchSize: 0,
        isDesktop: true,
    });

    useEffect(() => {
        // Set initial value based on actual window width
        const updateConfig = () => {
            setConfig(getPhotoLimitConfig(window.innerWidth));
        };

        updateConfig();

        // Listen for resize events
        window.addEventListener("resize", updateConfig);
        return () => window.removeEventListener("resize", updateConfig);
    }, []);

    return config;
}
