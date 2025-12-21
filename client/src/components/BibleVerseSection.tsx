import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { fadeIn, staggerContainer } from "@/lib/animations";

const BibleVerseSection = () => {
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: true, amount: 0.3 });

  return (
    <section 
      id="verse" 
      className="w-full h-[350px] md:h-[500px]"
      ref={sectionRef}
    >
      <div className="grid grid-cols-1 md:grid-cols-[40%_60%] h-full w-full">
        {/* Left side - Couple image (40% width) */}
        <img 
          src="/storage/admin/profiles/groom/gallery_1758978208533-1762699218291.JPG" 
          alt="Couple" 
          className="w-full h-[200px] md:h-full object-cover"
        />
        
        {/* Right side - Light background with verse (60% width) */}
        <div className="bg-[#f5f1eb] flex items-center justify-center p-6 md:p-12 h-[150px] md:h-full">
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
