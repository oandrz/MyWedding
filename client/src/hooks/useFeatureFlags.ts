import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

interface FeatureFlag {
  id: number;
  featureKey: string;
  featureName: string;
  description: string;
  enabled: boolean;
  updatedAt: string;
}

export function useFeatureFlags() {
  const lastUpdateRef = useRef<string | null>(null);
  const backoffMultiplierRef = useRef(1);

  const { data, isLoading, error, refetch } = useQuery<{ featureFlags: FeatureFlag[] }>({
    queryKey: ["/api/feature-flags"],
    staleTime: 10 * 1000, // 10 seconds - responsive for admin changes
    refetchInterval: (query) => {
      // Smart polling: faster when changes detected, slower when stable
      const currentData = query.state.data as { featureFlags: FeatureFlag[] } | undefined;
      const currentUpdate = currentData?.featureFlags?.[0]?.updatedAt;
      const hasChanges = currentUpdate && currentUpdate !== lastUpdateRef.current;
      
      if (hasChanges) {
        lastUpdateRef.current = currentUpdate;
        backoffMultiplierRef.current = 1;
        return 10 * 1000; // 10 seconds when changes detected
      } else {
        // Exponential backoff when no changes (max 60 seconds)
        backoffMultiplierRef.current = Math.min(backoffMultiplierRef.current * 1.5, 6);
        return Math.floor(10 * 1000 * backoffMultiplierRef.current);
      }
    },
    refetchOnWindowFocus: true, // Refetch when user returns to tab
  });

  // Enhanced refetch on window focus for immediate admin changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        refetch();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [refetch]);

  const isFeatureEnabled = (featureKey: string): boolean => {
    if (!data?.featureFlags) return true; // Default to enabled if no data
    const feature = data.featureFlags.find(f => f.featureKey === featureKey);
    return feature?.enabled ?? true; // Default to enabled if feature not found
  };

  const getFeatureFlag = (featureKey: string): FeatureFlag | undefined => {
    if (!data?.featureFlags) return undefined;
    return data.featureFlags.find(f => f.featureKey === featureKey);
  };

  return {
    featureFlags: data?.featureFlags ?? [],
    isLoading,
    error,
    isFeatureEnabled,
    getFeatureFlag,
  };
}

// Convenience hooks for specific features
export function useRsvpEnabled() {
  const { isFeatureEnabled } = useFeatureFlags();
  return isFeatureEnabled('rsvp');
}

export function useMessagesEnabled() {
  const { isFeatureEnabled } = useFeatureFlags();
  return isFeatureEnabled('messages');
}

export function useGalleryEnabled() {
  const { isFeatureEnabled } = useFeatureFlags();
  return isFeatureEnabled('gallery');
}

export function useMusicEnabled() {
  const { isFeatureEnabled } = useFeatureFlags();
  return isFeatureEnabled('music');
}

export function useCountdownEnabled() {
  const { isFeatureEnabled } = useFeatureFlags();
  return isFeatureEnabled('countdown');
}