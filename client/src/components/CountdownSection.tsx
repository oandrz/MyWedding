import { useState, useEffect } from "react";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { WEDDING_DATE } from "@/lib/constants";
import { fadeIn, staggerContainer } from "@/lib/animations";

type TimeLeft = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

const CountdownSection = () => {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });
  
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: true, amount: 0.2 });
  
  // Calculate and update the countdown
  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const difference = WEDDING_DATE.getTime() - now;
      
      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((difference % (1000 * 60)) / 1000)
        });
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      }
    };
    
    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);
    
    return () => clearInterval(timer);
  }, []);
  
  // Format time with leading zeros
  const formatTime = (time: number): string => {
    return time.toString().padStart(2, '0');
  };

  return (
    <section className="py-16 bg-background" ref={sectionRef}>
      <div className="container mx-auto px-4">
        <motion.div 
          className="max-w-3xl mx-auto bg-white shadow-lg rounded-lg p-8"
          variants={staggerContainer}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
        >
          <motion.h2 
            className="text-3xl font-cormorant text-center text-foreground mb-8"
            variants={fadeIn}
          >
            Counting Down to Our Special Day
          </motion.h2>
          
          <div className="flex justify-center text-center divide-x divide-accent divide-opacity-30">
            <div className="countdown-item px-4 md:px-8">
              <motion.div 
                className="text-4xl md:text-5xl font-cormorant text-primary"
                variants={fadeIn}
              >
                {formatTime(timeLeft.days)}
              </motion.div>
              <motion.div 
                className="text-xs uppercase font-montserrat text-foreground tracking-wider mt-2"
                variants={fadeIn}
              >
                Days
              </motion.div>
            </div>
            
            <div className="countdown-item px-4 md:px-8">
              <motion.div 
                className="text-4xl md:text-5xl font-cormorant text-primary"
                variants={fadeIn}
              >
                {formatTime(timeLeft.hours)}
              </motion.div>
              <motion.div 
                className="text-xs uppercase font-montserrat text-foreground tracking-wider mt-2"
                variants={fadeIn}
              >
                Hours
              </motion.div>
            </div>
            
            <div className="countdown-item px-4 md:px-8">
              <motion.div 
                className="text-4xl md:text-5xl font-cormorant text-primary"
                variants={fadeIn}
              >
                {formatTime(timeLeft.minutes)}
              </motion.div>
              <motion.div 
                className="text-xs uppercase font-montserrat text-foreground tracking-wider mt-2"
                variants={fadeIn}
              >
                Minutes
              </motion.div>
            </div>
            
            <div className="countdown-item px-4 md:px-8">
              <motion.div 
                className="text-4xl md:text-5xl font-cormorant text-primary"
                variants={fadeIn}
              >
                {formatTime(timeLeft.seconds)}
              </motion.div>
              <motion.div 
                className="text-xs uppercase font-montserrat text-foreground tracking-wider mt-2"
                variants={fadeIn}
              >
                Seconds
              </motion.div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default CountdownSection;
