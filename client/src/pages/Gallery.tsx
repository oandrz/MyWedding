import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import NavBar from "@/components/NavBar";
import UploadSheet from "@/components/UploadSheet";
import { Camera } from "lucide-react";

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  thumbnailLink: string;
  webViewLink: string;
  createdTime: string;
}

export function thumbnailUrl(link: string): string {
  return link.replace(/=s\d+$/, "=s800");
}

export function parseGuestName(filename: string): string {
  const idx = filename.indexOf("_");
  return idx > 0 ? filename.slice(0, idx) : "Wedding Guest";
}

const Gallery = () => {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [lightboxBroken, setLightboxBroken] = useState(false);
  const [brokenIds, setBrokenIds] = useState<Set<string>>(new Set());

  const { data, isLoading, isError, refetch } = useQuery<{ files: DriveFile[] }>({
    queryKey: ["/api/drive-folder-contents"],
    refetchInterval: 30_000,
  });

  const files = data?.files ?? [];

  const openLightbox = useCallback((index: number) => {
    setLightboxBroken(false);
    setLightboxIndex(index);
  }, []);
  const closeLightbox = useCallback(() => setLightboxIndex(null), []);
  const prevPhoto = useCallback(() =>
    setLightboxIndex((i) => (i !== null ? (i - 1 + files.length) % files.length : null)), [files.length]);
  const nextPhoto = useCallback(() =>
    setLightboxIndex((i) => (i !== null ? (i + 1) % files.length : null)), [files.length]);

  const touchStartX = useRef<number>(0);
  const didSwipe = useRef(false);

  const handleImageError = useCallback((id: string) => {
    setBrokenIds((prev) => new Set(prev).add(id));
  }, []);

  useEffect(() => {
    if (lightboxIndex === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prevPhoto();
      else if (e.key === "ArrowRight") nextPhoto();
      else if (e.key === "Escape") closeLightbox();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [lightboxIndex, prevPhoto, nextPhoto, closeLightbox]);

  return (
    <div className="min-h-screen bg-white">
      <NavBar />

      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-rose-100 px-4 py-3 flex items-center justify-between">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Camera className="h-5 w-5 text-rose-500" />
          Wedding Memories
        </h1>
        <span className="flex items-center gap-1.5 text-xs text-rose-400">
          <span className="h-2 w-2 rounded-full bg-rose-400 animate-pulse" />
          live
        </span>
      </div>

      {/* Main content */}
      <main className="px-2 py-4 pb-24">
        {isLoading && <GallerySkeleton />}

        {isError && (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-gray-500">
            <p>Couldn't load photos right now.</p>
            <button
              onClick={() => refetch()}
              className="text-rose-500 underline text-sm"
            >
              Retry
            </button>
          </div>
        )}

        {!isLoading && !isError && files.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-gray-500">
            <Camera className="h-12 w-12 text-gray-300" />
            <p className="text-lg">No memories yet — be the first to share!</p>
            <button
              onClick={() => setUploadOpen(true)}
              className="bg-rose-500 text-white px-6 py-2 rounded-full text-sm hover:bg-rose-600 transition-colors"
            >
              Share a Photo
            </button>
          </div>
        )}

        {!isLoading && !isError && files.length > 0 && (
          <div className="columns-2 lg:columns-3 gap-2" data-testid="photo-grid">
            {files.map((file, index) => (
              <div key={file.id} className="break-inside-avoid mb-2 relative group">
                {brokenIds.has(file.id) ? (
                  <div className="w-full aspect-video bg-gray-100 rounded-lg flex flex-col items-center justify-center gap-2 text-gray-400 text-sm">
                    <Camera className="h-6 w-6" />
                    <a
                      href={file.webViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-rose-400 underline"
                    >
                      View in Drive →
                    </a>
                  </div>
                ) : (
                  <>
                    <img
                      src={thumbnailUrl(file.thumbnailLink)}
                      alt={`Photo by ${parseGuestName(file.name)}`}
                      className="w-full rounded-lg cursor-pointer hover:brightness-95 transition-all opacity-0"
                      onClick={() => openLightbox(index)}
                      onError={() => handleImageError(file.id)}
                      onLoad={(e) => (e.currentTarget.style.opacity = "1")}
                      style={{ transition: "opacity 0.4s" }}
                      loading="lazy"
                    />
                    <div
                      data-testid="guest-name-overlay"
                      className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent rounded-b-lg px-3 py-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                    >
                      <p className="text-white text-sm font-medium">
                        {parseGuestName(file.name)}
                      </p>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Floating upload button */}
      <button
        onClick={() => setUploadOpen(true)}
        aria-label="Share photos"
        className="fixed bottom-6 right-6 z-20 w-14 h-14 rounded-full bg-rose-500 hover:bg-rose-600 text-white text-3xl shadow-lg flex items-center justify-center transition-colors"
        data-testid="fab-upload"
      >
        +
      </button>

      {/* Lightbox */}
      {lightboxIndex !== null && files[lightboxIndex] && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center"
          onClick={() => {
            if (didSwipe.current) { didSwipe.current = false; return; }
            closeLightbox();
          }}
          onTouchStart={(e) => {
            touchStartX.current = e.touches[0].clientX;
            didSwipe.current = false;
          }}
          onTouchEnd={(e) => {
            const delta = e.changedTouches[0].clientX - touchStartX.current;
            if (delta > 50) { didSwipe.current = true; prevPhoto(); }
            else if (delta < -50) { didSwipe.current = true; nextPhoto(); }
          }}
          data-testid="lightbox"
        >
          <button
            onClick={closeLightbox}
            aria-label="Close lightbox"
            className="absolute top-4 right-4 text-white text-3xl leading-none hover:text-gray-300"
          >
            ✕
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); prevPhoto(); }}
            aria-label="Previous photo"
            className="absolute left-4 text-white text-4xl hover:text-gray-300"
          >
            ‹
          </button>
          {lightboxBroken ? (
            <div className="flex flex-col items-center gap-3 text-white">
              <p className="text-sm opacity-70">Couldn't load photo</p>
              <a
                href={files[lightboxIndex].webViewLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-rose-300 underline text-sm"
                onClick={(e) => e.stopPropagation()}
              >
                View in Drive →
              </a>
            </div>
          ) : (
            <img
              src={thumbnailUrl(files[lightboxIndex].thumbnailLink).replace("=s800", "=s1600")}
              alt={`Photo by ${parseGuestName(files[lightboxIndex].name)}`}
              className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
              onClick={(e) => e.stopPropagation()}
              onError={() => setLightboxBroken(true)}
              data-testid="lightbox-image"
            />
          )}
          <button
            onClick={(e) => { e.stopPropagation(); nextPhoto(); }}
            aria-label="Next photo"
            className="absolute right-4 text-white text-4xl hover:text-gray-300"
          >
            ›
          </button>
          <p className="absolute bottom-4 text-white text-sm opacity-70">
            {parseGuestName(files[lightboxIndex].name)} · {lightboxIndex + 1} / {files.length}
          </p>
        </div>
      )}

      <UploadSheet open={uploadOpen} onClose={() => setUploadOpen(false)} />
    </div>
  );
};

const GallerySkeleton = () => (
  <div className="columns-2 lg:columns-3 gap-2" data-testid="gallery-skeleton">
    {Array.from({ length: 9 }).map((_, i) => (
      <div
        key={i}
        className="break-inside-avoid mb-2 rounded-lg bg-gray-100 animate-pulse"
        style={{ height: `${180 + (i % 3) * 60}px` }}
      />
    ))}
  </div>
);

export default Gallery;
