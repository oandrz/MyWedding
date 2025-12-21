import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { BRIDE_NAME, GROOM_NAME } from "@/lib/constants";
import { fadeIn, staggerContainer, slideFromLeft, slideFromRight, fadeInScale, revealText } from "@/lib/animations";
import type { ConfigImage } from "@shared/schema";

const CoupleSection = () => {
  const sectionRef = useRef(null);
  const titleRef = useRef(null);
  const brideRef = useRef(null);
  const groomRef = useRef(null);
  const storyRef = useRef(null);
  
  const isSectionInView = useInView(sectionRef, { once: true, amount: 0.1 });
  const isTitleInView = useInView(titleRef, { once: true, amount: 0.5 });
  const isBrideInView = useInView(brideRef, { once: true, amount: 0.5 });
  const isGroomInView = useInView(groomRef, { once: true, amount: 0.5 });
  const isStoryInView = useInView(storyRef, { once: true, amount: 0.3 });

  // Fetch bride profile image
  const { data: brideImagesData } = useQuery<{ images: ConfigImage[] }>({
    queryKey: ["/api/config-images/bride-profile"],
  });

  // Fetch groom profile image
  const { data: groomImagesData } = useQuery<{ images: ConfigImage[] }>({
    queryKey: ["/api/config-images/groom-profile"],
  });

  // Get the active profile images or fallback to default
  const brideImage = brideImagesData?.images?.find(img => img.isActive)?.imageUrl || 
    "https://images.unsplash.com/photo-1580489944761-15a19d654956?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=500&q=80";
  
  const groomImage = groomImagesData?.images?.find(img => img.isActive)?.imageUrl || 
    "https://images.unsplash.com/photo-1564564321837-a57b7070ac4f?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=500&q=80";
  
  return (
    <section id="couple" className="py-20 bg-gradient-to-b from-white via-amber-50/20 to-white paper-texture" ref={sectionRef}>
      <div className="container mx-auto px-4">
        <motion.div 
          className="text-center mb-16"
          ref={titleRef}
          variants={staggerContainer}
          initial="hidden"
          animate={isTitleInView ? "visible" : "hidden"}
        >
          <motion.h2 
            className="text-5xl md:text-6xl font-cormorant font-bold text-foreground mb-4"
            variants={revealText}
          >
            Our Love Story
          </motion.h2>
          <motion.div 
            className="w-24 h-1 metallic-rose mx-auto rounded-full"
            variants={fadeIn}
          ></motion.div>
        </motion.div>
        
        <div className="grid md:grid-cols-2 gap-12 max-w-5xl mx-auto">
          <motion.div 
            className="text-center"
            ref={groomRef}
            variants={slideFromLeft}
            initial="hidden"
            animate={isGroomInView ? "visible" : "hidden"}
          >
            <motion.div 
              className="mb-6 h-64 w-64 mx-auto rounded-full overflow-hidden shadow-2xl ring-4 ring-primary/20"
              variants={fadeInScale}
              whileHover={{ scale: 1.05, transition: { duration: 0.3 } }}
            >
              <img 
                className="w-full h-full object-cover" 
                src={groomImage} 
                alt={GROOM_NAME} 
              />
            </motion.div>
            <h3 className="text-3xl font-cormorant text-primary mb-2">{GROOM_NAME}</h3>
            <p className="text-foreground font-montserrat mb-4">The Groom</p>
            <p className="font-montserrat text-sm italic mb-1 text-[#dba9a9]">
              the son of
            </p>
            <p className="text-foreground font-montserrat text-sm">
              Mr. John Doe
            </p>
            <p className="text-muted-foreground font-montserrat text-sm">&</p>
            <p className="text-foreground font-montserrat text-sm">
              Mrs. Jane Doe
            </p>
          </motion.div>
          
          <motion.div 
            className="text-center"
            ref={brideRef}
            variants={slideFromRight}
            initial="hidden"
            animate={isBrideInView ? "visible" : "hidden"}
          >
            <motion.div 
              className="mb-6 h-64 w-64 mx-auto rounded-full overflow-hidden shadow-2xl ring-4 ring-secondary/20"
              variants={fadeInScale}
              whileHover={{ scale: 1.05, transition: { duration: 0.3 } }}
            >
              <img 
                className="w-full h-full object-cover" 
                src={brideImage} 
                alt={BRIDE_NAME} 
              />
            </motion.div>
            <h3 className="text-3xl font-cormorant text-primary mb-2">{BRIDE_NAME}</h3>
            <p className="text-foreground font-montserrat mb-4">The Bride</p>
            <p className="text-muted-foreground font-montserrat text-sm italic mb-1">
              the daughter of
            </p>
            <p className="text-foreground font-montserrat text-sm">
              Mr. Richard Smith
            </p>
            <p className="text-muted-foreground font-montserrat text-sm">&</p>
            <p className="text-foreground font-montserrat text-sm">
              Mrs. Mary Smith
            </p>
          </motion.div>
        </div>
        
        <motion.div 
          className="max-w-3xl mx-auto mt-20 text-center"
          ref={storyRef}
          variants={staggerContainer}
          initial="hidden"
          animate={isStoryInView ? "visible" : "hidden"}
        >
          <motion.h3 
            className="text-3xl font-cormorant text-foreground mb-6"
            variants={fadeIn}
          >
            How We Met
          </motion.h3>
          <motion.p 
            className="text-muted-foreground font-montserrat leading-relaxed mb-8"
            variants={fadeIn}
          >
            Our story began five years ago at a mutual friend's birthday party. {BRIDE_NAME} was helping with decorations when she accidentally spilled punch on {GROOM_NAME}'s new shoes. What started as an awkward apology turned into hours of conversation, laughter, and the exchange of phone numbers. Three years, countless adventures, and one rescue dog later, {GROOM_NAME} proposed during a sunrise hike to our favorite mountain lookout.
          </motion.p>
          <motion.div 
            className="italic text-primary font-cormorant text-xl"
            variants={fadeIn}
          >
            "True love stories never have endings." — Richard Bach
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

export default CoupleSection;
