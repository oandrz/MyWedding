import React, { useState } from "react";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { fadeIn, staggerContainer } from "@/lib/animations";

// Extended schema with validation
const rsvpSchema = z.object({
  firstName: z.string().min(1, { message: "First name is required" }),
  lastName: z.string().min(1, { message: "Last name is required" }),
  email: z.string().email({ message: "Please enter a valid email address" }),
  attending: z.boolean(),
  guestCount: z.number().optional(),
  dietaryRestrictions: z.string().optional(),
  message: z.string().optional()
});

type RsvpFormValues = z.infer<typeof rsvpSchema>;

const RsvpSection = () => {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const sectionRef = useRef(null);
  const titleRef = useRef(null);
  const formRef = useRef(null);
  
  const isSectionInView = useInView(sectionRef, { once: true, amount: 0.1 });
  const isTitleInView = useInView(titleRef, { once: true, amount: 0.5 });
  const isFormInView = useInView(formRef, { once: true, amount: 0.3 });
  
  const { toast } = useToast();
  
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<RsvpFormValues>({
    resolver: zodResolver(rsvpSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      attending: true,
      guestCount: 1,
      dietaryRestrictions: "",
      message: ""
    }
  });
  
  const attending = watch("attending");
  
  const { mutate, isPending, isSuccess, isError, error } = useMutation({
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
    mutate(data);
  };
  
  return (
    <section id="rsvp" className="py-20 bg-white" ref={sectionRef}>
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
            RSVP
          </motion.h2>
          <motion.div 
            className="w-20 h-0.5 bg-accent mx-auto mb-6"
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
          className="max-w-xl mx-auto bg-background p-8 rounded-lg shadow-md"
          ref={formRef}
          variants={staggerContainer}
          initial="hidden"
          animate={isFormInView ? "visible" : "hidden"}
        >
          {!isSubmitted ? (
            <motion.form 
              className="space-y-6"
              onSubmit={handleSubmit(onSubmit)}
              variants={fadeIn}
            >
              {/* Name Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="firstName" className="block text-foreground font-montserrat text-sm mb-2">First Name</label>
                  <input 
                    type="text" 
                    id="firstName" 
                    className="w-full px-4 py-2 border border-gray-300 rounded-md font-montserrat text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-20"
                    {...register("firstName")}
                  />
                  {errors.firstName && (
                    <p className="text-red-500 text-xs mt-1">{errors.firstName.message}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="lastName" className="block text-foreground font-montserrat text-sm mb-2">Last Name</label>
                  <input 
                    type="text" 
                    id="lastName" 
                    className="w-full px-4 py-2 border border-gray-300 rounded-md font-montserrat text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-20"
                    {...register("lastName")}
                  />
                  {errors.lastName && (
                    <p className="text-red-500 text-xs mt-1">{errors.lastName.message}</p>
                  )}
                </div>
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
                      value="true"
                      defaultChecked
                      {...register("attending", { 
                        setValueAs: (value) => value === "true" 
                      })}
                    />
                    <span className="ml-2 font-montserrat text-foreground">Joyfully Accept</span>
                  </label>
                  <label className="inline-flex items-center">
                    <input 
                      type="radio" 
                      className="text-primary focus:ring-primary focus:ring-opacity-20" 
                      value="false"
                      {...register("attending", { 
                        setValueAs: (value) => value === "true" 
                      })}
                      onChange={() => setValue("attending", false)}
                    />
                    <span className="ml-2 font-montserrat text-foreground">Regretfully Decline</span>
                  </label>
                </div>
              </div>
              
              {/* Number of Guests - Only show if attending */}
              {attending && (
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
              
              {/* Dietary Restrictions - Only show if attending */}
              {attending && (
                <div>
                  <label htmlFor="dietaryRestrictions" className="block text-foreground font-montserrat text-sm mb-2">Dietary Restrictions</label>
                  <textarea 
                    id="dietaryRestrictions" 
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md font-montserrat text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-20"
                    placeholder="Please let us know of any allergies or dietary requirements"
                    {...register("dietaryRestrictions")}
                  ></textarea>
                </div>
              )}
              
              {/* Message */}
              <div>
                <label htmlFor="message" className="block text-foreground font-montserrat text-sm mb-2">Message (Optional)</label>
                <textarea 
                  id="message" 
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md font-montserrat text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-20"
                  placeholder="Share your well wishes or thoughts"
                  {...register("message")}
                ></textarea>
              </div>
              
              {/* Submit Button */}
              <div className="text-center pt-4">
                <motion.button 
                  type="submit" 
                  className="custom-button px-8 py-3 bg-primary text-white font-montserrat uppercase tracking-wider text-sm hover:bg-opacity-90 hover:shadow-lg transition-all duration-300 rounded-sm disabled:opacity-70"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  disabled={isPending}
                >
                  {isPending ? "Sending..." : "Send RSVP"}
                </motion.button>
              </div>
            </motion.form>
          ) : (
            <motion.div 
              className="mt-8 p-6 bg-secondary bg-opacity-20 text-center rounded-md"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <i className="fas fa-check-circle text-secondary text-4xl mb-4"></i>
              </motion.div>
              <h3 className="text-2xl font-cormorant text-foreground mb-4">Thank You!</h3>
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
