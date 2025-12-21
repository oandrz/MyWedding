import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { fadeIn, staggerContainer } from "@/lib/animations";

const BibleVerseSection = () => {
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: true, amount: 0.5 });

  return (
    <section 
      id="verse" 
      className="py-16 bg-gradient-to-b from-white via-rose-50/30 to-white"
      ref={sectionRef}
    >
      <div className="container mx-auto px-4">
        <motion.div
          className="max-w-3xl mx-auto text-center"
          variants={staggerContainer}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
        >
          <motion.p 
            className="text-2xl md:text-3xl font-cormorant italic text-foreground leading-relaxed mb-6"
            variants={fadeIn}
          >
            "Love is patient, love is kind. It does not envy, it does not boast, it is not proud. 
            It does not dishonor others, it is not self-seeking, it is not easily angered, 
            it keeps no record of wrongs."
          </motion.p>
          <motion.p 
            className="text-lg font-montserrat text-primary font-medium"
            variants={fadeIn}
          >
            1 Corinthians 13:4-5
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
};

export default BibleVerseSection;
