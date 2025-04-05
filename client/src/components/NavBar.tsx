import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { BRIDE_NAME, GROOM_NAME } from "@/lib/constants";

const NavBar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  // Toggle mobile menu
  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  // Close mobile menu when clicking on a link
  const closeMenu = () => {
    setIsOpen(false);
  };

  // Add shadow to navbar on scroll
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 10) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 bg-background bg-opacity-95 transition-all duration-300 ${isScrolled ? 'shadow-md' : ''}`}>
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <a href="#hero" className="text-2xl font-cormorant font-semibold text-primary">
          {BRIDE_NAME.charAt(0)} & {GROOM_NAME.charAt(0)}
        </a>
        
        {/* Mobile menu button */}
        <button 
          className="md:hidden text-foreground focus:outline-none"
          onClick={toggleMenu}
          aria-label="Toggle menu"
        >
          <i className={`fas ${isOpen ? 'fa-times' : 'fa-bars'}`}></i>
        </button>
        
        {/* Desktop menu */}
        <div className="hidden md:flex space-x-8 text-foreground font-montserrat text-sm">
          <a href="#couple" className="nav-link hover:text-primary transition duration-300">Our Story</a>
          <a href="#details" className="nav-link hover:text-primary transition duration-300">Wedding Details</a>
          <a href="#gallery" className="nav-link hover:text-primary transition duration-300">Gallery</a>
          <a href="#rsvp" className="nav-link hover:text-primary transition duration-300">RSVP</a>
          <Link href="/messages" className="nav-link hover:text-primary transition duration-300">Messages</Link>
        </div>
      </div>
      
      {/* Mobile menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            className="bg-background md:hidden px-4 py-2 shadow-inner"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex flex-col space-y-3 font-montserrat text-sm pb-3">
              <a 
                href="#couple" 
                className="py-2 border-b border-gray-200 hover:text-primary transition duration-300"
                onClick={closeMenu}
              >
                Our Story
              </a>
              <a 
                href="#details" 
                className="py-2 border-b border-gray-200 hover:text-primary transition duration-300"
                onClick={closeMenu}
              >
                Wedding Details
              </a>
              <a 
                href="#gallery" 
                className="py-2 border-b border-gray-200 hover:text-primary transition duration-300"
                onClick={closeMenu}
              >
                Gallery
              </a>
              <a 
                href="#rsvp" 
                className="py-2 border-b border-gray-200 hover:text-primary transition duration-300"
                onClick={closeMenu}
              >
                RSVP
              </a>
              <Link 
                href="/messages" 
                className="py-2 hover:text-primary transition duration-300"
                onClick={closeMenu}
              >
                Messages
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default NavBar;
