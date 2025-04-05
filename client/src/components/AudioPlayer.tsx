import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Volume2, VolumeX } from 'lucide-react';

const AudioPlayer = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Attempt to load the audio with different paths
    const attemptLoad = (pathIndex = 0) => {
      // List of paths to try
      const paths = [
        '/music/wedding-piano.mp3', 
        'public/music/wedding-piano.mp3', 
        '/public/music/wedding-piano.mp3'
      ];
      
      if (pathIndex >= paths.length) {
        console.error("Failed to load audio from all paths");
        return;
      }
      
      console.log(`Attempting to load audio from: ${paths[pathIndex]}`);
      const audio = new Audio(paths[pathIndex]);
      audio.loop = true;
      audio.volume = 0.3;
      
      // If this path works
      audio.oncanplaythrough = () => {
        console.log("Audio loaded successfully:", paths[pathIndex]);
        audioRef.current = audio;
      };
      
      // If this path fails, try the next one
      audio.onerror = () => {
        console.error("Error loading audio from:", paths[pathIndex]);
        attemptLoad(pathIndex + 1);
      };
    };
    
    // Start trying to load the audio
    attemptLoad();

    // Function to start playing after user interacts with the page
    const startAudio = () => {
      if (!audioRef.current) {
        console.log("Audio not yet loaded, waiting...");
        return;
      }
      
      if (!isPlaying) {
        try {
          // Retry loading if necessary
          if (audioRef.current.readyState === 0) {
            audioRef.current.load();
          }
          
          // Play the audio
          audioRef.current.play()
            .then(() => {
              setIsPlaying(true);
              console.log("Audio playing successfully");
              // Remove event listeners once audio has started
              document.removeEventListener('click', startAudio);
              document.removeEventListener('touchstart', startAudio);
            })
            .catch(error => {
              console.error('Error playing audio:', error);
            });
        } catch (error) {
          console.error('Error accessing audio element:', error);
        }
      }
    };

    // Add event listeners for user interaction with a slight delay
    const timer = setTimeout(() => {
      document.addEventListener('click', startAudio);
      document.addEventListener('touchstart', startAudio);
    }, 1000);

    // Cleanup function
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', startAudio);
      document.removeEventListener('touchstart', startAudio);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const togglePlayPause = () => {
    if (!audioRef.current) {
      console.log("Audio not loaded yet, cannot toggle");
      return;
    }
    
    try {
      if (isPlaying) {
        // Pause the audio
        audioRef.current.pause();
        setIsPlaying(false);
        console.log("Audio paused");
      } else {
        // Retry loading if necessary
        if (audioRef.current.readyState === 0) {
          audioRef.current.load();
        }
        
        // Play the audio
        audioRef.current.play()
          .then(() => {
            setIsPlaying(true);
            console.log("Audio playing successfully");
          })
          .catch(error => {
            console.error('Error playing audio:', error);
          });
      }
    } catch (error) {
      console.error('Error toggling audio playback:', error);
    }
  };

  return (
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
  );
};

export default AudioPlayer;