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
        {/* Left side - Couple image */}
        <img 
          src="/storage/admin/profiles/groom/gallery_1758978208533-1762699218291.JPG" 
          alt="Couple" 
          className="w-full h-full object-cover min-h-[300px] md:min-h-[500px]"
        />
        
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
