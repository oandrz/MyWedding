import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { fadeIn, staggerContainer } from "@/lib/animations";

const BibleVerseSection = () => {
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: true, amount: 0.3 });

  return (
    <section 
      id="verse" 
      className="min-h-[400px] md:min-h-[500px]"
      ref={sectionRef}
    >
      <div className="grid md:grid-cols-2 h-full">
        {/* Left side - Dark background with couple silhouette */}
        <div className="bg-[#3a3a3a] flex items-center justify-center p-8 md:p-12 min-h-[300px] md:min-h-[500px]">
          <div className="text-center">
            {/* Couple silhouette placeholder - you can replace with actual image */}
            <svg 
              viewBox="0 0 200 280" 
              className="w-48 h-64 md:w-64 md:h-80 mx-auto"
              fill="none"
            >
              {/* Man silhouette */}
              <ellipse cx="70" cy="45" rx="25" ry="30" fill="#9ca3af" />
              <path d="M45 80 C45 80, 40 180, 50 250 L90 250 C100 180, 95 80, 95 80 Z" fill="#ffffff" />
              <path d="M50 250 L50 280 L60 280 L60 250 Z" fill="#6b7280" />
              <path d="M80 250 L80 280 L90 280 L90 250 Z" fill="#6b7280" />
              
              {/* Woman silhouette */}
              <ellipse cx="130" cy="45" rx="22" ry="28" fill="#9ca3af" />
              <path d="M100 45 C95 60, 90 80, 95 100 L100 100 L100 80 Z" fill="#374151" />
              <path d="M160 45 C165 60, 165 100, 160 120 L155 120 L155 80 Z" fill="#374151" />
              <path d="M108 75 C108 75, 100 180, 105 250 L155 250 C160 180, 152 75, 152 75 Z" fill="#ffffff" />
              <path d="M105 250 L90 280 L170 280 L155 250 Z" fill="#1f2937" />
            </svg>
          </div>
        </div>
        
        {/* Right side - Light background with verse */}
        <div className="bg-[#f5f1eb] flex items-center justify-center p-8 md:p-12 min-h-[300px] md:min-h-[500px]">
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
            >
              "And over all these virtues put on love, which binds them all together in perfect unity."
            </motion.p>
            
            <motion.p 
              className="text-sm font-montserrat text-gray-500 tracking-widest uppercase"
              variants={fadeIn}
            >
              Colossians 3:14
            </motion.p>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default BibleVerseSection;
