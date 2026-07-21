import { motion } from "framer-motion";
import { fadeIn, staggerContainer } from "@/lib/animations";
import { useLanguage } from "@/contexts/LanguageContext";
import { useWeddingConfig } from "@/content/useWeddingConfig";

const Footer = () => {
  const { t, dateLocale } = useLanguage();
  const { weddingDate } = useWeddingConfig();
  // Format the wedding date
  const formattedDate = new Intl.DateTimeFormat(dateLocale, {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  }).format(weddingDate);
  
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
            {t("groomName")} & {t("brideName")}
          </motion.h2>
          
          <motion.p 
            className="font-montserrat text-sm mb-8"
            variants={fadeIn}
          >
            {formattedDate}
          </motion.p>
          
          <motion.div 
            className="mb-8"
            variants={fadeIn}
          >
            <span className="font-cormorant text-5xl italic text-white text-opacity-90 tracking-widest">{t("footerMonogram")}</span>
          </motion.div>
          
          <motion.p 
            className="font-montserrat text-xs text-[#F9F5F0] text-opacity-70"
            variants={fadeIn}
          >
            {t("madeWithLove")}
          </motion.p>
        </motion.div>
      </div>
    </footer>
  );
};

export default Footer;
