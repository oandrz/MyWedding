import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Car, ParkingSquare } from "lucide-react";
import { VENUES, WEDDING_DATE } from "@/lib/constants";
import { fadeIn, staggerContainer, slideUp } from "@/lib/animations";
import { useLanguage } from "@/contexts/LanguageContext";

interface ScheduleEvent {
  id: number;
  title: string;
  titleId: string;
  time: string;
  description: string;
  descriptionId: string;
  sortOrder: number;
  createdAt: string;
}

const DetailsSection = () => {
  const { data: scheduleData } = useQuery<{ scheduleEvents: ScheduleEvent[] }>({
    queryKey: ["/api/schedule"],
  });
  const scheduleEvents = scheduleData?.scheduleEvents ?? [];

  const { t, dateLocale, lang } = useLanguage();

  const sectionRef = useRef(null);
  const titleRef = useRef(null);
  const venuesRef = useRef(null);
  const mapRef = useRef(null);
  const parkingRef = useRef(null);
  const scheduleRef = useRef(null);
  
  const isSectionInView = useInView(sectionRef, { once: true, amount: 0.1 });
  const isTitleInView = useInView(titleRef, { once: true, amount: 0.5 });
  const areVenuesInView = useInView(venuesRef, { once: true, amount: 0.3 });
  const isMapInView = useInView(mapRef, { once: true, amount: 0.3 });
  const isParkingInView = useInView(parkingRef, { once: true, amount: 0.3 });
  const isScheduleInView = useInView(scheduleRef, { once: true, amount: 0.3 });
  
  // Format wedding date
  const formattedDate = new Intl.DateTimeFormat(dateLocale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  }).format(WEDDING_DATE);

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
            {t("theDetails")}
          </motion.h2>
          <motion.div 
            className="w-24 h-1 bg-primary mx-auto rounded-full mb-6"
            variants={fadeIn}
          ></motion.div>
          <motion.p 
            className="text-muted-foreground font-montserrat text-lg max-w-2xl mx-auto"
            variants={fadeIn}
          >
            {t("detailsSubtitle")}
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
                {t("date")}
              </div>
              <div className="text-3xl md:text-4xl font-cormorant font-bold text-primary">
                {formattedDate}
              </div>
            </div>
            
            {/* Schedule */}
            {scheduleEvents.length > 0 && (
              <div>
                <div className="text-sm uppercase font-montserrat tracking-widest text-muted-foreground mb-4">
                  {t("schedule")}
                </div>
                <div className={`grid grid-cols-1 gap-6 md:gap-8 ${scheduleEvents.length >= 2 ? "md:grid-cols-2" : ""}`}>
                  <div className={`text-center ${scheduleEvents.length >= 2 ? "md:border-r md:border-primary/20 md:pr-8" : ""}`}>
                    <div className="text-xl md:text-2xl font-cormorant font-semibold text-primary mb-1">
                      {lang === "id" && scheduleEvents[0].titleId ? scheduleEvents[0].titleId : scheduleEvents[0].title}
                    </div>
                    <div className="text-lg md:text-xl font-cormorant text-foreground">
                      {scheduleEvents[0].time}
                    </div>
                  </div>
                  {scheduleEvents.length >= 2 && (
                    <div className="text-center">
                      <div className="text-xl md:text-2xl font-cormorant font-semibold text-primary mb-1">
                        {lang === "id" && scheduleEvents[scheduleEvents.length - 1].titleId ? scheduleEvents[scheduleEvents.length - 1].titleId : scheduleEvents[scheduleEvents.length - 1].title}
                      </div>
                      <div className="text-lg md:text-xl font-cormorant text-foreground">
                        {scheduleEvents[scheduleEvents.length - 1].time}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* Location - IMPOSSIBLE TO MISS */}
            <div className="pt-6 border-t border-primary/20">
              <div className="text-sm uppercase font-montserrat tracking-widest text-muted-foreground mb-3">
                {t("location")}
              </div>
              <div className="text-3xl md:text-4xl font-cormorant font-bold text-primary mb-3">
                {VENUES[0].location}
              </div>
              <div className="font-montserrat text-sm text-muted-foreground mb-4">
                {VENUES[0].address}
              </div>
              
              <motion.a 
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(VENUES[0].location + " " + VENUES[0].address)}`}
                target="_blank" 
                rel="noreferrer"
                className="inline-block px-8 py-4 bg-primary text-white font-montserrat uppercase tracking-wider text-sm rounded-lg shadow-lg hover:bg-opacity-90 transition-all duration-300"
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
              >
                <i className="fas fa-map-marker-alt mr-2"></i> {t("viewOnMaps")}
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
              src={`https://www.google.com/maps?q=${encodeURIComponent(VENUES[0].location + " " + VENUES[0].address)}&output=embed`}
              allowFullScreen
              loading="lazy"
              title="Wedding venue location"
            ></iframe>
          </motion.div>
        </motion.div>
        
        {/* Transportation & Parking Notice */}
        <motion.div
          ref={parkingRef}
          className="max-w-3xl mx-auto mb-20 glass-card rounded-3xl p-8 md:p-10"
          variants={staggerContainer}
          initial="hidden"
          animate={isParkingInView ? "visible" : "hidden"}
        >
          <motion.h3
            className="text-3xl md:text-4xl font-cormorant font-bold text-center text-foreground mb-8"
            variants={fadeIn}
          >
            {t("gettingThere")}
          </motion.h3>

          <div className="space-y-6">
            <motion.div className="flex items-start gap-4" variants={fadeIn}>
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Car className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h4 className="font-cormorant text-xl font-semibold text-foreground mb-1">
                  {t("rideHailingTitle")}
                </h4>
                <p className="font-montserrat text-sm text-muted-foreground leading-relaxed">
                  {t("rideHailingBody")}
                </p>
              </div>
            </motion.div>

            <motion.div className="flex items-start gap-4" variants={fadeIn}>
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <ParkingSquare className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h4 className="font-cormorant text-xl font-semibold text-foreground mb-1">{t("valetTitle")}</h4>
                <p className="font-montserrat text-sm text-muted-foreground leading-relaxed">{t("valetBody")}</p>
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* Schedule */}
        <motion.div 
          className="max-w-3xl mx-auto"
          ref={scheduleRef}
          variants={staggerContainer}
          initial="hidden"
          animate={isScheduleInView ? "visible" : "hidden"}
        >
          <motion.h3 
            className="text-4xl md:text-5xl font-cormorant font-bold text-center text-foreground mb-10"
            variants={fadeIn}
          >
            {t("weddingDaySchedule")}
          </motion.h3>
          
          <div className="relative">
            {/* Timeline Line */}
            <div className="absolute left-1/2 transform -translate-x-1/2 h-full w-0.5 bg-primary bg-opacity-30"></div>
            
            {/* Timeline Items */}
            <div className="space-y-12">
              {scheduleEvents.map((item, index) => (
                <motion.div
                  key={item.id}
                  className="relative flex items-center justify-between"
                  variants={fadeIn}
                  initial="hidden"
                  animate={isScheduleInView ? "visible" : "hidden"}
                  custom={index}
                  transition={{ delay: index * 0.2 }}
                >
                  <div className="w-5/12 pr-8 text-right">
                    <h4 className="font-cormorant text-xl text-primary">{lang === "id" && item.titleId ? item.titleId : item.title}</h4>
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
                      {lang === "id" && item.descriptionId ? item.descriptionId : item.description}
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
