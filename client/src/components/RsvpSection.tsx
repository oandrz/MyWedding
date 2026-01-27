import React, { useState, useEffect } from "react";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { fadeIn, staggerContainer } from "@/lib/animations";
import confetti from "canvas-confetti";

// Extended schema with validation
const rsvpSchema = z.object({
  name: z.string().min(1, { message: "Name is required" }),
  email: z.string().email({ message: "Please enter a valid email address" }),
  attending: z.boolean(),
  guestCount: z.number().optional()
});

type RsvpFormValues = z.infer<typeof rsvpSchema>;

const RsvpSection = () => {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showGuestOptions, setShowGuestOptions] = useState(true);
  const [guestName, setGuestName] = useState<string>("");
  const sectionRef = useRef(null);
  const titleRef = useRef(null);
  const formRef = useRef(null);
  
  const isSectionInView = useInView(sectionRef, { once: true, amount: 0.1 });
  const isTitleInView = useInView(titleRef, { once: true, amount: 0.5 });
  const isFormInView = useInView(formRef, { once: true, amount: 0.3 });
  
  const { toast } = useToast();
  
  const { register, handleSubmit, setValue, formState: { errors } } = useForm<RsvpFormValues>({
    resolver: zodResolver(rsvpSchema),
    defaultValues: {
      name: "",
      email: "",
      attending: true,
      guestCount: 1
    }
  });

  // Get guest name from URL param on mount and pre-fill form
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const toParam = urlParams.get("to");
      if (toParam) {
        const decodedName = decodeURIComponent(toParam);
        setGuestName(decodedName);
        // Pre-fill the form name field to prevent typos
        setValue("name", decodedName);
      }
    }
  }, [setValue]);
  
  // Check if this guest has already submitted an RSVP
  const { data: rsvpCheck, isLoading: isCheckingRsvp } = useQuery<{ exists: boolean; rsvp: any }>({
    queryKey: ['/api/rsvp/check', guestName],
    queryFn: async () => {
      if (!guestName) return { exists: false, rsvp: null };
      const response = await fetch(`/api/rsvp/check?name=${encodeURIComponent(guestName)}`);
      return response.json();
    },
    enabled: !!guestName,
  });

  // Handle radio button changes
  const handleAttendanceChange = (isAttending: boolean) => {
    setValue("attending", isAttending);
    setShowGuestOptions(isAttending);
    
    // If not attending, clear guest-specific fields
    if (!isAttending) {
      setValue("guestCount", undefined);
    } else {
      setValue("guestCount", 1);
    }
  };
  
  const { mutate, isPending } = useMutation({
    mutationFn: async (data: RsvpFormValues) => {
      console.log("Submitting RSVP:", data);
      const response = await apiRequest("POST", "/api/rsvp", data);
      const responseData = await response.json();
      console.log("RSVP response:", responseData);
      return responseData;
    },
    onSuccess: (data) => {
      console.log("RSVP submitted successfully:", data);
      setIsSubmitted(true);
      
      // Invalidate RSVP check query so UI updates correctly
      queryClient.invalidateQueries({ queryKey: ['/api/rsvp/check', guestName] });
      
      // Trigger confetti celebration
      const duration = 3 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

      function randomInRange(min: number, max: number) {
        return Math.random() * (max - min) + min;
      }

      const interval = setInterval(function() {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
        });
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
        });
      }, 250);
      
      toast({
        title: "RSVP Submitted",
        description: "Thank you for your response!",
        variant: "default"
      });
    },
    onError: (error) => {
      console.error("RSVP submission error:", error);
      toast({
        title: "Error",
        description: `Failed to submit RSVP: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive"
      });
    }
  });
  
  const onSubmit = (data: RsvpFormValues) => {
    console.log("Form data to submit:", data);
    mutate(data);
  };
  
  return (
    <section id="rsvp" className="py-20 bg-gradient-to-b from-white via-rose-50/30 to-white paper-texture" ref={sectionRef}>
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
            variants={fadeIn}
          >
            RSVP
          </motion.h2>
          <motion.div 
            className="w-24 h-1 mx-auto mb-6 rounded-full bg-[#dba9a9]"
            variants={fadeIn}
          ></motion.div>
          <motion.p 
            className="text-muted-foreground font-montserrat max-w-2xl mx-auto"
            variants={fadeIn}
          >
            Please let us know if you'll be joining us to celebrate our special day
          </motion.p>
        </motion.div>
        
        <motion.div 
          className="max-w-xl mx-auto glass-card p-8 md:p-10 rounded-2xl"
          ref={formRef}
          variants={staggerContainer}
          initial="hidden"
          animate={isFormInView ? "visible" : "hidden"}
        >
          {isCheckingRsvp ? (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-muted-foreground font-montserrat">Checking your RSVP status...</p>
            </div>
          ) : rsvpCheck?.exists ? (
            <motion.div 
              className="p-8 text-center rounded-md"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="mb-4"
              >
                <i className="fas fa-heart text-primary text-4xl"></i>
              </motion.div>
              <h3 className="text-3xl font-cormorant text-foreground mb-3">Thank You!</h3>
              <p className="text-foreground font-montserrat">
                We've already received your RSVP{rsvpCheck.rsvp?.attending ? " and look forward to celebrating with you" : ""}.
              </p>
            </motion.div>
          ) : !isSubmitted ? (
            <motion.form 
              className="space-y-6"
              onSubmit={handleSubmit(onSubmit)}
              variants={fadeIn}
            >
              {/* Name Field */}
              <div>
                <label htmlFor="name" className="block text-foreground font-montserrat text-sm mb-2">Name</label>
                <input 
                  type="text" 
                  id="name" 
                  className="w-full px-4 py-2 border border-gray-300 rounded-md font-montserrat text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-20"
                  {...register("name")}
                />
                {errors.name && (
                  <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>
                )}
              </div>
              
              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-foreground font-montserrat text-sm mb-2">Email</label>
                <input 
                  type="email" 
                  id="email" 
                  className="w-full px-4 py-2 border border-gray-300 rounded-md font-montserrat text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-20"
                  {...register("email")}
                />
                {errors.email && (
                  <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>
                )}
              </div>
              
              {/* Attendance */}
              <div>
                <label className="block text-foreground font-montserrat text-sm mb-4">Will you be attending?</label>
                <div className="flex space-x-6">
                  <label className="inline-flex items-center">
                    <input 
                      type="radio" 
                      className="text-primary focus:ring-primary focus:ring-opacity-20" 
                      name="attending"
                      value="true"
                      defaultChecked
                      onChange={() => handleAttendanceChange(true)}
                    />
                    <span className="ml-2 font-montserrat text-foreground">Joyfully Accept</span>
                  </label>
                  <label className="inline-flex items-center">
                    <input 
                      type="radio" 
                      className="text-primary focus:ring-primary focus:ring-opacity-20" 
                      name="attending"
                      value="false"
                      onChange={() => handleAttendanceChange(false)}
                    />
                    <span className="ml-2 font-montserrat text-foreground">Regretfully Decline</span>
                  </label>
                </div>
              </div>
              
              {/* Number of Guests - Only show if attending */}
              {showGuestOptions && (
                <div>
                  <label htmlFor="guestCount" className="block text-foreground font-montserrat text-sm mb-2">Number of Guests (Including Yourself)</label>
                  <select 
                    id="guestCount" 
                    className="w-full px-4 py-2 border border-gray-300 rounded-md font-montserrat text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-20"
                    {...register("guestCount", {
                      setValueAs: (value) => parseInt(value, 10)
                    })}
                  >
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="4">4</option>
                  </select>
                </div>
              )}
              

              
              {/* Submit Button */}
              <div className="text-center pt-4">
                <motion.button 
                  type="submit" 
                  className="bg-primary px-10 py-4 text-white font-montserrat uppercase tracking-wider text-sm rounded-lg shadow-lg hover:bg-opacity-90 transition-all duration-300 disabled:opacity-70"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  disabled={isPending}
                  data-testid="button-submit-rsvp"
                >
                  {isPending ? "Sending..." : "Send RSVP"}
                </motion.button>
              </div>
            </motion.form>
          ) : (
            <motion.div 
              className="p-8 text-center rounded-md"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="mb-4"
              >
                <i className="fas fa-heart text-primary text-4xl"></i>
              </motion.div>
              <h3 className="text-3xl font-cormorant text-foreground mb-3">Thank You!</h3>
              <p className="text-foreground font-montserrat">
                We've received your RSVP and look forward to celebrating with you.
              </p>
            </motion.div>
          )}
        </motion.div>
      </div>
    </section>
  );
};

export default RsvpSection;
