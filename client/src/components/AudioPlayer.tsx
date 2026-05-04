import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { motion } from 'framer-motion';
import { Volume2, VolumeX } from 'lucide-react';
import { useLocation } from 'wouter';
import { useMusicEnabled } from '@/hooks/useFeatureFlags';
import { useQuery } from '@tanstack/react-query';

export interface AudioPlayerHandle {
  startAutoplay: () => void;
}

const AudioPlayer = forwardRef<AudioPlayerHandle, Record<string, never>>((_, ref) => {
  const isMusicEnabled = useMusicEnabled();
  const [isPlaying, setIsPlaying] = useState(false);
  const audioEl = useRef<HTMLAudioElement>(null);
  const [location] = useLocation();

  const isAdminPage = location.includes('/admin');

  const { data: musicData } = useQuery<{ musicUrl: string }>({
    queryKey: ['/api/settings/music'],
    enabled: !isAdminPage && isMusicEnabled,
  });

  const musicUrl = musicData?.musicUrl || '/music/wedding-piano.mp3';

  useEffect(() => {
    if (audioEl.current && musicUrl) {
      audioEl.current.volume = 0.3;
      audioEl.current.load();
    }
  }, [musicUrl]);

  useImperativeHandle(ref, () => ({
    startAutoplay: () => {
      if (!audioEl.current) return;
      audioEl.current.play()
        .then(() => setIsPlaying(true))
        .catch(() => {});
    },
  }), []);

  const togglePlayPause = () => {
    if (!audioEl.current) return;

    try {
      if (isPlaying) {
        audioEl.current.pause();
        setIsPlaying(false);
      } else {
        const playPromise = audioEl.current.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              setIsPlaying(true);
            })
            .catch(err => {
              console.error("Failed to play audio:", err);
            });
        }
      }
    } catch (error) {
      console.error("Error toggling audio:", error);
    }
  };

  if (isAdminPage || !isMusicEnabled) {
    return null;
  }

  return (
    <>
      <audio
        ref={audioEl}
        src={musicUrl}
        loop
        preload="auto"
      />

      <motion.div
        className="fixed bottom-8 right-8 z-50 flex items-center justify-center bg-primary/80 backdrop-blur-sm border border-white/30 rounded-full p-4 shadow-lg cursor-pointer"
        whileHover={{ scale: 1.1, boxShadow: "0 0 15px rgba(255,255,255,0.5)" }}
        whileTap={{ scale: 0.9 }}
        onClick={togglePlayPause}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        {isPlaying ? (
          <Volume2 size={24} className="text-white" />
        ) : (
          <VolumeX size={24} className="text-white/70" />
        )}
        <span className="ml-2 text-sm text-white font-montserrat hidden md:inline">
          {isPlaying ? "Stop Music" : "Play Music"}
        </span>
      </motion.div>
    </>
  );
});

AudioPlayer.displayName = 'AudioPlayer';

export default AudioPlayer;
