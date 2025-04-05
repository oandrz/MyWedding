import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Volume2, VolumeX } from 'lucide-react';
import ReactAudioPlayer from 'react-audio-player';

const AudioPlayer = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<ReactAudioPlayer>(null);

  useEffect(() => {
    // Function to start playing after user interacts with the page
    const startAudio = () => {
      if (audioRef.current && !isPlaying) {
        try {
          const audioElement = audioRef.current.audioEl.current;
          if (audioElement) {
            audioElement.volume = 0.3;
            audioElement.play()
              .then(() => {
                setIsPlaying(true);
                // Remove event listeners once audio has started
                document.removeEventListener('click', startAudio);
                document.removeEventListener('touchstart', startAudio);
              })
              .catch(error => console.error('Error playing audio:', error));
          }
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
    };
  }, [isPlaying]);

  const togglePlayPause = () => {
    if (audioRef.current && audioRef.current.audioEl.current) {
      if (isPlaying) {
        audioRef.current.audioEl.current.pause();
      } else {
        audioRef.current.audioEl.current.play()
          .catch(error => console.error('Error playing audio:', error));
      }
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <>
      <ReactAudioPlayer
        src="/music/wedding-piano.mp3"
        ref={audioRef}
        loop
        style={{ display: 'none' }}
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