import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Volume2, VolumeX } from 'lucide-react';

const AudioPlayer = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Create audio element
    audioRef.current = new Audio('/music/wedding-piano.mp3');
    audioRef.current.loop = true;
    audioRef.current.volume = 0.3; // Start at lower volume

    // Function to start playing after user interacts with the page
    const startAudio = () => {
      if (audioRef.current && !isPlaying) {
        audioRef.current.play()
          .then(() => {
            setIsPlaying(true);
            // Remove event listeners once audio has started
            document.removeEventListener('click', startAudio);
            document.removeEventListener('touchstart', startAudio);
          })
          .catch(error => console.error('Error playing audio:', error));
      }
    };

    // Add event listeners for user interaction
    document.addEventListener('click', startAudio);
    document.addEventListener('touchstart', startAudio);

    // Cleanup function
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      document.removeEventListener('click', startAudio);
      document.removeEventListener('touchstart', startAudio);
    };
  }, []);

  const togglePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play()
          .catch(error => console.error('Error playing audio:', error));
      }
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <motion.div 
      className="fixed bottom-8 right-8 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm rounded-full p-3 shadow-lg cursor-pointer"
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      onClick={togglePlayPause}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 2 }}
    >
      {isPlaying ? (
        <Volume2 size={24} className="text-primary" />
      ) : (
        <VolumeX size={24} className="text-gray-500" />
      )}
    </motion.div>
  );
};

export default AudioPlayer;