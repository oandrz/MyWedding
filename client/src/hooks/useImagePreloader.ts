import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ConfigImage } from '@shared/schema';

const getResponsiveImageUrl = (baseUrl: string, width: number, quality: number = 75): string => {
  if (!baseUrl.includes('unsplash.com')) return baseUrl;
  
  const url = new URL(baseUrl);
  url.searchParams.set('w', width.toString());
  url.searchParams.set('q', quality.toString());
  url.searchParams.set('auto', 'format');
  url.searchParams.set('fit', 'crop');
  
  return url.toString();
};

export function useImagePreloader() {
  const preloadedUrls = useRef<Set<string>>(new Set());
  
  const { data: galleryData } = useQuery<{ images: ConfigImage[] }>({
    queryKey: ["/api/config-images/gallery"],
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: bannerData } = useQuery<{ images: ConfigImage[] }>({
    queryKey: ["/api/config-images/banner"],
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!galleryData?.images) return;

    galleryData.images.forEach((img, index) => {
      const optimizedUrl = img.imageUrl.includes('unsplash.com') 
        ? getResponsiveImageUrl(img.imageUrl, 600, 70)
        : img.imageUrl;
      
      if (preloadedUrls.current.has(optimizedUrl)) return;
      preloadedUrls.current.add(optimizedUrl);
      
      const imgEl = new Image();
      imgEl.src = optimizedUrl;
    });
  }, [galleryData]);

  useEffect(() => {
    if (!bannerData?.images?.[0]) return;

    const bannerUrl = bannerData.images[0].imageUrl;
    if (preloadedUrls.current.has(bannerUrl)) return;
    preloadedUrls.current.add(bannerUrl);

    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = bannerUrl;
    (link as any).fetchPriority = 'high';
    document.head.appendChild(link);
  }, [bannerData]);
}
