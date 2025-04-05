import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { WEDDING_SCHEDULE, VENUES } from "@/lib/constants";
import { fadeIn, staggerContainer } from "@/lib/animations";

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
  
  return (
    <section id="details" className="py-20 bg-white" ref={sectionRef}>
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
            Wedding Details
          </motion.h2>
          <motion.div 
            className="w-20 h-0.5 bg-accent mx-auto"
            variants={fadeIn}
          ></motion.div>
        </motion.div>
        
        <motion.div 
          className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto"
          ref={venuesRef}
          variants={staggerContainer}
          initial="hidden"
          animate={areVenuesInView ? "visible" : "hidden"}
        >
          {VENUES.map((venue, index) => (
            <motion.div 
              key={index}
              className="text-center p-8 border border-gray-100 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-300"
              variants={fadeIn}
              whileHover={{ y: -5, transition: { duration: 0.3 } }}
            >
              <div className={`w-16 h-16 ${index === 0 ? 'bg-primary' : index === 1 ? 'bg-secondary' : 'bg-accent'} bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-6`}>
                <i className={`${venue.icon} ${index === 0 ? 'text-primary' : index === 1 ? 'text-secondary' : 'text-accent'}`}></i>
              </div>
              <h3 className="text-2xl font-cormorant text-foreground mb-3">{venue.title}</h3>
              
              {venue.date && (
                <p className="text-muted-foreground font-montserrat text-sm mb-4">{venue.date}</p>
              )}
              
              {venue.time && (
                <p className="text-muted-foreground font-montserrat text-sm mb-4">{venue.time}</p>
              )}
              
              <p className="text-muted-foreground font-montserrat text-sm mb-4">{venue.location}</p>
              <p className="text-muted-foreground font-montserrat text-sm">{venue.address}</p>
              
              {venue.bookingCode && (
                <p className="text-muted-foreground font-montserrat text-sm mt-4">Special room rate code: {venue.bookingCode}</p>
              )}
              
              {venue.bookingUrl && (
                <a href={venue.bookingUrl} className="text-primary font-montserrat text-sm hover:underline mt-4 inline-block">Book Your Stay</a>
              )}
            </motion.div>
          ))}
        </motion.div>
        
        {/* Location Map */}
        <motion.div 
          className="mt-20 max-w-5xl mx-auto"
          ref={mapRef}
          variants={staggerContainer}
          initial="hidden"
          animate={isMapInView ? "visible" : "hidden"}
        >
          <motion.h3 
            className="text-3xl font-cormorant text-center text-foreground mb-10"
            variants={fadeIn}
          >
            Location
          </motion.h3>
          
          <motion.div 
            className="aspect-w-16 aspect-h-9 rounded-lg overflow-hidden shadow-lg"
            variants={fadeIn}
          >
            <iframe
              width="100%"
              height="450"
              className="w-full h-96 border-0"
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3024.2219901290355!2d-74.00369368400567!3d40.71312937933185!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x89c25a47df06b185%3A0xc80da61da9e2a3b!2sCity%20Hall%20Park!5e0!3m2!1sen!2sus!4v1628664477739!5m2!1sen!2sus"
              allowFullScreen
              loading="lazy"
              title="Wedding venue location"
            ></iframe>
          </motion.div>
          
          <motion.div 
            className="mt-8 text-center"
            variants={fadeIn}
          >
            <motion.a 
              href="https://goo.gl/maps/1234" 
              target="_blank" 
              rel="noreferrer"
              className="custom-button inline-block px-6 py-2 bg-secondary text-white font-montserrat uppercase tracking-wider text-sm hover:bg-opacity-90 hover:shadow-md transition-all duration-300 rounded-sm"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <i className="fas fa-directions mr-2"></i> Get Directions
            </motion.a>
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
            className="text-3xl font-cormorant text-center text-foreground mb-10"
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
