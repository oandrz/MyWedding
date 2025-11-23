import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { WEDDING_SCHEDULE } from "@/lib/constants";
import { fadeIn, staggerContainer, slideUp } from "@/lib/animations";

const DetailsSection = () => {
  const sectionRef = useRef(null);
  const titleRef = useRef(null);
  const venuesRef = useRef(null);
  const mapRef = useRef(null);
  const scheduleRef = useRef(null);
  
  const isSectionInView = useInView(sectionRef, { once: true, amount: 0.1 });
  const isTitleInView = useInView(titleRef, { once: true, amount: 0.5 });
  const areVenuesInView = useInView(venuesRef, { once: true, amount: 0.3 });
  const isMapInView = useInView(mapRef, { once: true, amount: 0.3 });
  const isScheduleInView = useInView(scheduleRef, { once: true, amount: 0.3 });

  // Fetch basic info for wedding date
  const { data: basicInfoData } = useQuery<{ section: { data: any } }>({
    queryKey: ["/api/content/basic_info"],
  });

  // Fetch venue info
  const { data: venueInfoData, isLoading: venueInfoLoading } = useQuery<{ section: { data: any } }>({
    queryKey: ["/api/content/venue_info"],
  });

  const weddingDateStr = basicInfoData?.section?.data?.weddingDate || "2026-07-05T14:00:00.000Z";
  const weddingDate = new Date(weddingDateStr);
  
  const venueName = venueInfoData?.section?.data?.venueName || "Casakhasa Kemang";
  const venueAddress = venueInfoData?.section?.data?.venueAddress || "Jl. Bungur No.20 1, RT.1/RW.5, Bangka, Kec. Mampang Prpt., Kota Jakarta Selatan, Daerah Khusus Ibukota Jakarta 12730, Indonesia";
  const ceremonyTime = venueInfoData?.section?.data?.ceremonyTime || "2:00 PM - 3:30 PM";
  const receptionTime = venueInfoData?.section?.data?.receptionTime || "4:30 PM - 10:00 PM";
  const mapUrl = venueInfoData?.section?.data?.mapUrl || "https://www.google.com/maps/place/Casakhasa/@-6.2594469,106.8204341,17z";
  
  // Format wedding date
  const formattedDate = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  }).format(weddingDate);

  return (
    <section id="details" className="py-20 bg-gradient-to-b from-white via-amber-50/20 to-white paper-texture" ref={sectionRef}>
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
            The Details
          </motion.h2>
          <motion.div 
            className="w-24 h-1 bg-primary mx-auto rounded-full mb-6"
            variants={fadeIn}
          ></motion.div>
          <motion.p 
            className="text-muted-foreground font-montserrat text-lg max-w-2xl mx-auto"
            variants={fadeIn}
          >
            Join us as we celebrate our special day
          </motion.p>
        </motion.div>
        
        {/* KEY WEDDING INFO - Prominent */}
        <motion.div 
          ref={venuesRef}
          className="max-w-3xl mx-auto mb-20 glass-card rounded-3xl p-8 md:p-12"
          variants={slideUp}
          initial="hidden"
          animate={areVenuesInView ? "visible" : "hidden"}
        >
          <div className="text-center space-y-6">
            {/* Date */}
            <div>
              <div className="text-sm uppercase font-montserrat tracking-widest text-muted-foreground mb-2">
                Date
              </div>
              <div className="text-3xl md:text-4xl font-cormorant font-bold text-primary">
                {formattedDate}
              </div>
            </div>
            
            {/* Time */}
            <div>
              <div className="text-sm uppercase font-montserrat tracking-widest text-muted-foreground mb-2">
                Ceremony
              </div>
              <div className="text-2xl md:text-3xl font-cormorant text-foreground">
                {venueInfoLoading ? "..." : ceremonyTime}
              </div>
            </div>

            {/* Reception Time */}
            <div>
              <div className="text-sm uppercase font-montserrat tracking-widest text-muted-foreground mb-2">
                Reception
              </div>
              <div className="text-2xl md:text-3xl font-cormorant text-foreground">
                {venueInfoLoading ? "..." : receptionTime}
              </div>
            </div>
            
            {/* Location - IMPOSSIBLE TO MISS */}
            <div className="pt-6 border-t border-primary/20">
              <div className="text-sm uppercase font-montserrat tracking-widest text-muted-foreground mb-3">
                Location
              </div>
              <div className="text-3xl md:text-4xl font-cormorant font-bold text-primary mb-3">
                {venueInfoLoading ? "..." : venueName}
              </div>
              <div className="font-montserrat text-sm text-muted-foreground mb-4">
                {venueInfoLoading ? "..." : venueAddress}
              </div>
              
              <motion.a 
                href={mapUrl} 
                target="_blank" 
                rel="noreferrer"
                className="inline-block px-8 py-4 bg-primary text-white font-montserrat uppercase tracking-wider text-sm rounded-lg shadow-lg hover:bg-opacity-90 transition-all duration-300"
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
              >
                <i className="fas fa-map-marker-alt mr-2"></i> View on Google Maps
              </motion.a>
            </div>
          </div>
        </motion.div>
        
        {/* Location Map */}
        <motion.div 
          className="max-w-5xl mx-auto mb-20"
          ref={mapRef}
          variants={fadeIn}
          initial="hidden"
          animate={isMapInView ? "visible" : "hidden"}
        >
          <motion.div 
            className="rounded-2xl overflow-hidden shadow-2xl"
            variants={fadeIn}
          >
            <iframe
              width="100%"
              height="450"
              className="w-full h-96 border-0"
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3966.0!2d106.8204341!3d-6.2594469!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x2e69f22adf2c9a27%3A0x118d6eaa20e4454b!2sCasakhasa!5e0!3m2!1sen!2sus!4v1628664477739!5m2!1sen!2sus"
              allowFullScreen
              loading="lazy"
              title={`Wedding venue location - ${venueName}`}
            ></iframe>
          </motion.div>
        </motion.div>
        
        {/* Schedule */}
        <motion.div 
          className="mt-20 max-w-3xl mx-auto"
          ref={scheduleRef}
          variants={staggerContainer}
          initial="hidden"
          animate={isScheduleInView ? "visible" : "hidden"}
        >
          <motion.h3 
            className="text-4xl md:text-5xl font-cormorant font-bold text-center text-foreground mb-10"
            variants={fadeIn}
          >
            Wedding Day Schedule
          </motion.h3>
          
          <div className="relative">
            {/* Timeline Line */}
            <div className="absolute left-1/2 transform -translate-x-1/2 h-full w-0.5 bg-primary bg-opacity-30"></div>
            
            {/* Timeline Items */}
            <div className="space-y-12">
              {WEDDING_SCHEDULE.map((item, index) => (
                <motion.div 
                  key={index}
                  className="relative flex items-center justify-between"
                  variants={fadeIn}
                  initial="hidden"
                  animate={isScheduleInView ? "visible" : "hidden"}
                  custom={index}
                  transition={{ delay: index * 0.2 }}
                >
                  <div className="w-5/12 pr-8 text-right">
                    <h4 className="font-cormorant text-xl text-primary">{item.title}</h4>
                    <p className="font-montserrat text-sm text-foreground">{item.time}</p>
                  </div>
                  
                  <motion.div 
                    className="absolute left-1/2 transform -translate-x-1/2 w-4 h-4 rounded-full bg-primary z-10"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: index * 0.2 + 0.1, duration: 0.5 }}
                  ></motion.div>
                  
                  <div className="w-5/12 pl-8">
                    <p className="font-montserrat text-sm text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default DetailsSection;
