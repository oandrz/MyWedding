import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { fadeIn, staggerContainer } from "@/lib/animations";
import type { ConfigImage } from "@shared/schema";
import { useLanguage } from "@/contexts/LanguageContext";

const BibleVerseSection = () => {
  const { t } = useLanguage();
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: true, amount: 0.3 });

  // Fetch verse section image from admin config
  const { data: verseImageData } = useQuery<{ images: ConfigImage[] }>({
    queryKey: ["/api/config-images/verse-image"],
  });

  const verseImage = verseImageData?.images?.find(img => img.isActive)?.imageUrl;

  return (
    <section 
      id="verse" 
      className="w-full"
      ref={sectionRef}
    >
      <div className="grid grid-cols-1 md:grid-cols-[40%_60%] w-full items-stretch">
        {/* Left side - Couple image (40% width) */}
        <div className="flex overflow-hidden bg-[#3a3a3a] items-center justify-center">
          {verseImage ? (
            <img 
              src={verseImage} 
              alt="Couple" 
              className="w-full h-auto md:max-h-[500px] object-cover"
              data-testid="verse-section-image"
            />
          ) : (
            <div className="text-gray-400 text-center p-8">
              <p className="font-montserrat text-sm">Upload image via Admin</p>
              <p className="font-montserrat text-xs mt-1">(Image Type: verse-image)</p>
            </div>
          )}
        </div>
        
        {/* Right side - Light background with verse (60% width) */}
        <div className="bg-[#f5f1eb] flex items-center justify-center p-8 md:p-16 min-h-[300px] md:min-h-[500px]">
          <motion.div
            className="max-w-md text-center"
            variants={staggerContainer}
            initial="hidden"
            animate={isInView ? "visible" : "hidden"}
          >
            {/* Quote mark */}
            <motion.div 
              className="text-5xl md:text-6xl text-gray-300 font-serif mb-4"
              variants={fadeIn}
            >
              "
            </motion.div>
            
            <motion.p
              className="text-xl md:text-2xl font-cormorant italic text-gray-700 leading-relaxed mb-8"
              variants={fadeIn}
            >{t("bibleVerse")}</motion.p>

            <motion.p
              className="text-sm font-montserrat text-gray-500 tracking-widest uppercase"
              variants={fadeIn}
            >{t("bibleVerseRef")}</motion.p>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default BibleVerseSection;
