import { motion } from "framer-motion";
import { BRIDE_NAME, GROOM_NAME, WEDDING_DATE } from "@/lib/constants";
import { fadeIn, floatAnimation, pulseAnimation } from "@/lib/animations";

const HeroSection = () => {
  // Format the wedding date
  const formattedDate = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  }).format(WEDDING_DATE);
  
  return (
    <section id="hero" className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
      <div 
        className="absolute inset-0 bg-cover bg-center" 
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1519741347686-c1e0aadf4611?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1920&q=80')" }}
      >
        <div className="absolute inset-0 bg-[#4A4A4A] bg-opacity-40"></div>
      </div>
      
      <motion.div 
        className="relative z-10 text-center px-4"
        initial="hidden"
        animate="visible"
        variants={fadeIn}
      >
        <motion.h3 
          className="text-xl md:text-2xl font-montserrat text-[#F9F5F0] uppercase tracking-widest mb-4"
          variants={floatAnimation}
          initial="hidden"
          animate={["visible", "float"]}
        >
          We're Getting Married
        </motion.h3>
        
        <motion.h1 
          className="text-5xl md:text-7xl font-cormorant font-light text-white mb-8"
          variants={fadeIn}
        >
          {BRIDE_NAME} & {GROOM_NAME}
        </motion.h1>
        
        <motion.div 
          className="w-24 h-0.5 bg-accent mx-auto mb-8"
          variants={fadeIn}
        ></motion.div>
        
        <motion.p 
          className="text-xl md:text-2xl font-cormorant text-white mb-12"
          variants={fadeIn}
        >
          {formattedDate}
        </motion.p>
        
        <motion.a 
          href="#rsvp" 
          className="custom-button inline-block px-8 py-3 bg-primary text-white font-montserrat uppercase tracking-wider text-sm hover:bg-opacity-90 hover:shadow-lg transition-all duration-300 rounded-sm"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          variants={fadeIn}
        >
          RSVP Now
        </motion.a>
      </motion.div>
      
      <motion.div 
        className="absolute bottom-8 left-0 right-0 text-center"
        variants={pulseAnimation}
        initial="initial"
        animate="pulse"
      >
        <a href="#couple" className="text-white">
          <i className="fas fa-chevron-down"></i>
        </a>
      </motion.div>
    </section>
  );
};

export default HeroSection;
