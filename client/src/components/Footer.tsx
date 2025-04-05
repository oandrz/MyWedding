import { motion } from "framer-motion";
import { BRIDE_NAME, GROOM_NAME, WEDDING_DATE } from "@/lib/constants";
import { fadeIn, staggerContainer } from "@/lib/animations";

const Footer = () => {
  // Format the wedding date
  const formattedDate = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  }).format(WEDDING_DATE);
  
  return (
    <footer className="py-10 bg-[#4A4A4A] text-[#F9F5F0]">
      <div className="container mx-auto px-4 text-center">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={staggerContainer}
        >
          <motion.h2 
            className="text-3xl font-cormorant mb-4"
            variants={fadeIn}
          >
            {BRIDE_NAME} & {GROOM_NAME}
          </motion.h2>
          
          <motion.p 
            className="font-montserrat text-sm mb-8"
            variants={fadeIn}
          >
            {formattedDate}
          </motion.p>
          
          <motion.div 
            className="flex justify-center space-x-6 mb-8"
            variants={fadeIn}
          >
            <motion.a 
              href="#" 
              className="text-[#F9F5F0] hover:text-accent transition-colors duration-300"
              whileHover={{ scale: 1.2 }}
              whileTap={{ scale: 0.9 }}
            >
              <i className="fab fa-instagram text-xl"></i>
            </motion.a>
            <motion.a 
              href="#" 
              className="text-[#F9F5F0] hover:text-accent transition-colors duration-300"
              whileHover={{ scale: 1.2 }}
              whileTap={{ scale: 0.9 }}
            >
              <i className="fab fa-facebook text-xl"></i>
            </motion.a>
            <motion.a 
              href="#" 
              className="text-[#F9F5F0] hover:text-accent transition-colors duration-300"
              whileHover={{ scale: 1.2 }}
              whileTap={{ scale: 0.9 }}
            >
              <i className="fa fa-envelope text-xl"></i>
            </motion.a>
          </motion.div>
          
          <motion.p 
            className="font-montserrat text-xs text-[#F9F5F0] text-opacity-70"
            variants={fadeIn}
          >
            Made with love for our special day
          </motion.p>
        </motion.div>
      </div>
    </footer>
  );
};

export default Footer;
