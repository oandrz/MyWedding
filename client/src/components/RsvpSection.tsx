import React, { useState, useEffect } from "react";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { fadeIn, staggerContainer } from "@/lib/animations";
import confetti from "canvas-confetti";

// Schema for email-based RSVP (flag off)
const emailRsvpSchema = z.object({
  name: z.string().min(1, { message: "Name is required" }),
  email: z.string().email({ message: "Please enter a valid email address" }),
  attendanceType: z.enum(["both", "holy_matrimony", "reception", "decline"]),
  guestCount: z.number().optional()
});

// Schema for code-based RSVP (flag on) — no email needed
const codeRsvpSchema = z.object({
  attendanceType: z.enum(["both", "holy_matrimony", "reception", "decline"]),
  guestCount: z.number().optional()
});

type EmailRsvpFormValues = z.infer<typeof emailRsvpSchema>;
type CodeRsvpFormValues = z.infer<typeof codeRsvpSchema>;
type RsvpFormValues = EmailRsvpFormValues | CodeRsvpFormValues;

const RsvpSection = () => {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showGuestOptions, setShowGuestOptions] = useState(true);
  const [guestName, setGuestName] = useState<string>("");
  const [inviteCode, setInviteCode] = useState<string>("");
  const sectionRef = useRef(null);
  const titleRef = useRef(null);
  const formRef = useRef(null);

  const isSectionInView = useInView(sectionRef, { once: true, amount: 0.1 });
  const isTitleInView = useInView(titleRef, { once: true, amount: 0.5 });
  const isFormInView = useInView(formRef, { once: true, amount: 0.3 });

  const { toast } = useToast();
  const { getFeatureFlag, isLoading: isFlagsLoading } = useFeatureFlags();
  const rsvpEnabled = getFeatureFlag("rsvp")?.enabled === true;

  // Flow determined by URL param: ?code= → code flow, otherwise → email flow
  const useCodeFlow = !!inviteCode;

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<EmailRsvpFormValues>({
    resolver: zodResolver(useCodeFlow ? codeRsvpSchema as any : emailRsvpSchema),
    defaultValues: {
      name: "",
      email: "",
      attendanceType: "both",
      guestCount: 1
    }
  });

  // Get guest name or invite code from URL params on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const codeParam = urlParams.get("code");
      if (codeParam) {
        setInviteCode(codeParam);
      }
      const toParam = urlParams.get("to");
      if (toParam) {
        const decodedName = decodeURIComponent(toParam);
        setGuestName(decodedName);
        setValue("name", decodedName);
      }
    }
  }, [setValue]);

  // Fetch invite details when using invite code flow
  const { data: inviteData, isLoading: isLoadingInvite, error: inviteError } = useQuery<{ invite: any }>({
    queryKey: ['/api/invites', inviteCode],
    queryFn: async () => {
      const response = await fetch(`/api/invites/${encodeURIComponent(inviteCode)}`);
      if (!response.ok) throw new Error("Invalid invite code");
      return response.json();
    },
    enabled: !!inviteCode,
  });

  // Set guest name from invite when loaded
  useEffect(() => {
    if (inviteData?.invite?.name) {
      setGuestName(inviteData.invite.name);
    }
  }, [inviteData]);

  // Check if this guest has already submitted an RSVP (code flow: use invite's rsvp; email flow: check by name)
  const inviteHasRsvp = useCodeFlow && inviteData?.invite?.rsvp;

  const { data: rsvpCheck, isLoading: isCheckingRsvp } = useQuery<{ exists: boolean; rsvp: any }>({
    queryKey: ['/api/rsvp/check', guestName],
    queryFn: async () => {
      if (!guestName) return { exists: false, rsvp: null };
      const response = await fetch(`/api/rsvp/check?name=${encodeURIComponent(guestName)}`);
      return response.json();
    },
    enabled: !useCodeFlow && !!guestName,
  });

  const handleAttendanceChange = (type: "both" | "holy_matrimony" | "reception" | "decline") => {
    setValue("attendanceType", type);
    setShowGuestOptions(type !== "decline");

    if (type === "decline") {
      setValue("guestCount", undefined);
    } else if (!showGuestOptions) {
      setValue("guestCount", 1);
    }
  };
  
  const { mutate, isPending } = useMutation({
    mutationFn: async (data: RsvpFormValues) => {
      let payload: Record<string, unknown>;
      if (useCodeFlow) {
        payload = {
          code: inviteCode,
          attendanceType: data.attendanceType,
          guestCount: data.guestCount,
        };
      } else {
        payload = data;
      }
      const response = await apiRequest("POST", "/api/rsvp", payload);
      const responseData = await response.json();
      return responseData;
    },
    onSuccess: (data) => {
      setIsSubmitted(true);
      setIsEditing(false);

      // Invalidate relevant queries so UI updates correctly
      if (useCodeFlow) {
        queryClient.invalidateQueries({ queryKey: ['/api/invites', inviteCode] });
      } else {
        queryClient.invalidateQueries({ queryKey: ['/api/rsvp/check', guestName] });
      }
      
      // Only fire confetti for attending guests
      if (data.rsvp?.attendanceType !== "decline") {
        // Trigger confetti celebration
        const duration = 3 * 1000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

        const randomInRange = (min: number, max: number) => {
          return Math.random() * (max - min) + min;
        };

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
      }

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
  
  // Feature flag controls visibility of the entire RSVP section
  if (!isFlagsLoading && !rsvpEnabled) {
    return null;
  }

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
          {/* Invite code flow: loading or error states */}
          {useCodeFlow && isLoadingInvite ? (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-muted-foreground font-montserrat">Looking up your invitation...</p>
            </div>
          ) : useCodeFlow && inviteError ? (
            <div className="text-center py-8">
              <i className="fas fa-exclamation-circle text-red-400 text-4xl mb-4 block"></i>
              <h3 className="text-2xl font-cormorant text-foreground mb-3">Invalid Invite Code</h3>
              <p className="text-muted-foreground font-montserrat">
                The invite code in your link is not valid. Please check your invitation and try again.
              </p>
            </div>
          ) : (isCheckingRsvp || (useCodeFlow && isLoadingInvite)) ? (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-muted-foreground font-montserrat">Checking your RSVP status...</p>
            </div>
          ) : ((rsvpCheck?.exists || inviteHasRsvp) && !isEditing) ? (
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
              <h3 className="text-3xl font-cormorant text-foreground mb-3">Thank You{guestName ? `, ${guestName}` : ""}!</h3>
              <p className="text-foreground font-montserrat">
                {(() => {
                  const existingRsvp = inviteHasRsvp ? inviteData.invite.rsvp : rsvpCheck?.rsvp;
                  if (existingRsvp?.attendanceType && existingRsvp.attendanceType !== "decline") {
                    const eventLabel = existingRsvp.attendanceType === "both"
                      ? "Holy Matrimony and Reception"
                      : existingRsvp.attendanceType === "holy_matrimony"
                      ? "Holy Matrimony"
                      : "Reception";
                    return `We've received your RSVP for the ${eventLabel} and look forward to celebrating with you.`;
                  }
                  return "We've already received your RSVP.";
                })()}
              </p>
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                onClick={() => {
                  const existingRsvp = inviteHasRsvp ? inviteData.invite.rsvp : rsvpCheck?.rsvp;
                  if (existingRsvp) {
                    setValue("attendanceType", existingRsvp.attendanceType || "both");
                    const gc = existingRsvp.guestCount ?? 1;
                    setValue("guestCount", gc);
                    setShowGuestOptions(existingRsvp.attendanceType !== "decline");
                  }
                  setIsEditing(true);
                  setIsSubmitted(false);
                }}
                className="mt-6 px-6 py-2 border border-primary/40 text-primary font-montserrat text-sm rounded-full hover:bg-primary/5 transition-all duration-200"
              >
                Update RSVP
              </motion.button>
            </motion.div>
          ) : !isSubmitted ? (
            <motion.form
              className="space-y-6"
              onSubmit={handleSubmit(onSubmit)}
              variants={fadeIn}
            >
              {/* Personalized greeting for invite code flow */}
              {useCodeFlow && inviteData?.invite && (
                <div className="text-center pb-2">
                  <p className="text-lg font-cormorant text-foreground">
                    Dear <span className="font-semibold">{inviteData.invite.name}</span>,
                  </p>
                  <p className="text-sm text-muted-foreground font-montserrat mt-1">
                    Please confirm your attendance below
                  </p>
                </div>
              )}

              {/* Name & Email fields — only for email-based flow */}
              {!useCodeFlow && (
                <>
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
                </>
              )}
              
              {/* Attendance Type */}
              <div>
                <label className="block text-foreground font-montserrat text-sm mb-4">Will you be joining us?</label>
                <div className="flex flex-wrap gap-2">
                  {([
                    { value: "both", label: "Both" },
                    { value: "holy_matrimony", label: "Holy Matrimony" },
                    { value: "reception", label: "Reception" },
                    { value: "decline", label: "Regretfully Decline" },
                  ] as const).map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleAttendanceChange(option.value)}
                      className={`px-4 py-2 rounded-full font-montserrat text-sm transition-all duration-200 ${
                        option.value === watch("attendanceType")
                          ? "bg-primary text-white shadow-md"
                          : option.value === "decline"
                          ? "border border-gray-200 text-gray-400 hover:border-gray-300"
                          : "border border-gray-300 text-foreground hover:border-primary/50"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
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
                  {isPending ? "Sending..." : isEditing ? "Update RSVP" : "Send RSVP"}
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
