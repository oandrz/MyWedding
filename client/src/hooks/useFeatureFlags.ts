import { useQuery } from "@tanstack/react-query";

interface FeatureFlag {
  id: number;
  featureKey: string;
  featureName: string;
  description: string;
  enabled: boolean;
  updatedAt: string;
}

export function useFeatureFlags() {
  const { data, isLoading, error } = useQuery<{ featureFlags: FeatureFlag[] }>({
    queryKey: ["/api/feature-flags"],
    staleTime: 5 * 60 * 1000, // 5 minutes - feature flags don't change often
    refetchInterval: 60 * 1000, // Refetch every minute to pick up admin changes
  });

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