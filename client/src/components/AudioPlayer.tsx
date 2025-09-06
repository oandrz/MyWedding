import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Volume2, VolumeX } from 'lucide-react';
import { useLocation } from 'wouter';
import { useMusicEnabled } from '@/hooks/useFeatureFlags';

const AudioPlayer = () => {
  const isMusicEnabled = useMusicEnabled();
  const [isPlaying, setIsPlaying] = useState(false);
  const audioEl = useRef<HTMLAudioElement>(null);
  const [location] = useLocation();
  
  // Hide audio player on admin pages
  const isAdminPage = location.includes('/admin');
  
  if (isAdminPage || !isMusicEnabled) {
    return null;
  }

  useEffect(() => {
    // Preload the audio when the component mounts
    if (audioEl.current) {
      audioEl.current.volume = 0.3;
      audioEl.current.load(); // Force preload
    }
  }, []);

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
              console.log("Audio playing successfully");
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

  return (
    <>
      <audio 
        ref={audioEl} 
        src="/music/wedding-piano.mp3" 
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
          {isPlaying ? "Wedding Music" : "Play Music"}
        </span>
      </motion.div>
    </>
  );
};

export default AudioPlayer;