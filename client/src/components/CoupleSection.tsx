import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { BRIDE_NAME, GROOM_NAME } from "@/lib/constants";
import { fadeIn, staggerContainer, slideFromLeft, slideFromRight } from "@/lib/animations";

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
  
  return (
    <section id="couple" className="py-20 bg-background" ref={sectionRef}>
      <div className="container mx-auto px-4">
        <motion.div 
          className="text-center mb-16"
          ref={titleRef}
          variants={staggerContainer}
          initial="hidden"
          animate={isTitleInView ? "visible" : "hidden"}
        >
          <motion.h2 
            className="text-4xl font-cormorant text-foreground mb-4"
            variants={fadeIn}
          >
            Our Love Story
          </motion.h2>
          <motion.div 
            className="w-20 h-0.5 bg-accent mx-auto"
            variants={fadeIn}
          ></motion.div>
        </motion.div>
        
        <div className="grid md:grid-cols-2 gap-12 max-w-5xl mx-auto">
          <motion.div 
            className="text-center"
            ref={brideRef}
            variants={slideFromLeft}
            initial="hidden"
            animate={isBrideInView ? "visible" : "hidden"}
          >
            <div className="mb-6 h-64 w-64 mx-auto rounded-full overflow-hidden shadow-lg">
              <img 
                className="w-full h-full object-cover" 
                src="https://images.unsplash.com/photo-1580489944761-15a19d654956?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=500&q=80" 
                alt={BRIDE_NAME} 
              />
            </div>
            <h3 className="text-3xl font-cormorant text-primary mb-2">{BRIDE_NAME}</h3>
            <p className="text-foreground font-montserrat mb-6">The Bride</p>
            <p className="text-muted-foreground font-montserrat text-sm leading-relaxed">
              {BRIDE_NAME} is a passionate kindergarten teacher who loves baking, hiking on weekends, and has an infectious laugh that lights up any room. She dreams of traveling the world and hopes to visit at least 30 countries in her lifetime.
            </p>
          </motion.div>
          
          <motion.div 
            className="text-center"
            ref={groomRef}
            variants={slideFromRight}
            initial="hidden"
            animate={isGroomInView ? "visible" : "hidden"}
          >
            <div className="mb-6 h-64 w-64 mx-auto rounded-full overflow-hidden shadow-lg">
              <img 
                className="w-full h-full object-cover" 
                src="https://images.unsplash.com/photo-1564564321837-a57b7070ac4f?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=500&q=80" 
                alt={GROOM_NAME} 
              />
            </div>
            <h3 className="text-3xl font-cormorant text-primary mb-2">{GROOM_NAME}</h3>
            <p className="text-foreground font-montserrat mb-6">The Groom</p>
            <p className="text-muted-foreground font-montserrat text-sm leading-relaxed">
              {GROOM_NAME} is a software engineer with a talent for playing the guitar. He's an avid sports enthusiast who never misses a game and has a collection of vintage records that he treasures. His calm demeanor perfectly balances {BRIDE_NAME}'s energetic personality.
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
