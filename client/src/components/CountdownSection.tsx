import { useState, useEffect, memo } from "react";
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

// Memoized time unit component to prevent unnecessary re-renders
const TimeUnit = memo(({ value, label }: { value: number; label: string }) => {
  const formatTime = (time: number): string => {
    return time.toString().padStart(2, '0');
  };

  return (
    <div className="countdown-item px-4 md:px-8">
      <motion.div 
        className="text-4xl md:text-5xl font-cormorant text-primary"
        variants={fadeIn}
      >
        {formatTime(value)}
      </motion.div>
      <motion.div 
        className="text-xs uppercase font-montserrat text-foreground tracking-wider mt-2"
        variants={fadeIn}
      >
        {label}
      </motion.div>
    </div>
  );
});

TimeUnit.displayName = 'TimeUnit';

const CountdownSection = memo(() => {
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
        const newTimeLeft = {
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((difference % (1000 * 60)) / 1000)
        };
        
        // Only update state if values have changed (prevents re-render on same values)
        setTimeLeft(prev => {
          if (prev.days !== newTimeLeft.days || 
              prev.hours !== newTimeLeft.hours || 
              prev.minutes !== newTimeLeft.minutes || 
              prev.seconds !== newTimeLeft.seconds) {
            return newTimeLeft;
          }
          return prev;
        });
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      }
    };
    
    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);
    
    return () => clearInterval(timer);
  }, []);

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
            <TimeUnit value={timeLeft.days} label="Days" />
            <TimeUnit value={timeLeft.hours} label="Hours" />
            <TimeUnit value={timeLeft.minutes} label="Minutes" />
            <TimeUnit value={timeLeft.seconds} label="Seconds" />
          </div>
        </motion.div>
      </div>
    </section>
  );
});

CountdownSection.displayName = 'CountdownSection';

export default CountdownSection;
