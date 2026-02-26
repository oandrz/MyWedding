import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useLocation } from "wouter";
import { BRIDE_NAME, GROOM_NAME } from "@/lib/constants";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";

const NavBar = () => {
  const { isFeatureEnabled } = useFeatureFlags();
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [location] = useLocation();
  const [activeSection, setActiveSection] = useState<string>('');

  // Toggle mobile menu
  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  // Close mobile menu when clicking on a link
  const closeMenu = () => {
    setIsOpen(false);
  };

  // Helper function to scroll to a section with a delay
  // This prevents the menu closing animation from interrupting the scroll
  const scrollToSection = (sectionId: string) => {
    closeMenu();
    setActiveSection(sectionId);
    // Use requestAnimationFrame + setTimeout to ensure the scroll happens
    // after the menu closing state change and re-render complete
    requestAnimationFrame(() => {
      setTimeout(() => {
        const element = document.getElementById(sectionId);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 50);
    });
  };

  // Add shadow to navbar on scroll and track active section
  useEffect(() => {
    const handleScroll = () => {
      // Handle navbar shadow
      if (window.scrollY > 10) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }

      // Handle active section highlighting
      if (location === '/') {
        const sections = ['couple', 'details', 'gallery', 'rsvp', 'messages'];

        // Find the section that is currently in view
        for (const section of sections) {
          const element = document.getElementById(section);
          if (element) {
            const rect = element.getBoundingClientRect();
            // Check if the section is in the viewport (with some offset to trigger earlier)
            if (rect.top <= 100 && rect.bottom >= 100) {
              setActiveSection(section);
              break;
            }
          }
        }

        // If we're at the top of the page, clear the active section
        if (window.scrollY < 100) {
          setActiveSection('');
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [location]);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 bg-background bg-opacity-95 transition-all duration-300 ${isScrolled ? 'shadow-md' : ''}`}>
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <Link href="/" className="text-3xl font-cormorant italic text-primary tracking-widest">
          A&C
        </Link>

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
          <Link
            href="/"
            className={`nav-link relative hover:text-primary transition duration-300 ${location === '/' && !activeSection ? 'text-primary' : ''}`}
          >
            Home
            {location === '/' && !activeSection && (
              <motion.span
                className="absolute bottom-[-4px] left-0 right-0 h-0.5 bg-primary"
                layoutId="navbar-underline"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            )}
          </Link>
          {location === '/' && (
            <>
              <a
                href="#couple"
                className={`nav-link relative hover:text-primary transition duration-300 ${activeSection === 'couple' ? 'text-primary' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  const element = document.getElementById('couple');
                  if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                  setActiveSection('couple');
                }}
              >
                Our Story
                {activeSection === 'couple' && (
                  <motion.span
                    className="absolute bottom-[-4px] left-0 right-0 h-0.5 bg-primary"
                    layoutId="navbar-underline"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
              </a>
              <a
                href="#details"
                className={`nav-link relative hover:text-primary transition duration-300 ${activeSection === 'details' ? 'text-primary' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  const element = document.getElementById('details');
                  if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                  setActiveSection('details');
                }}
              >
                Wedding Details
                {activeSection === 'details' && (
                  <motion.span
                    className="absolute bottom-[-4px] left-0 right-0 h-0.5 bg-primary"
                    layoutId="navbar-underline"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
              </a>
              {isFeatureEnabled('gallery') && (
                <a
                  href="#gallery"
                  className={`nav-link relative hover:text-primary transition duration-300 ${activeSection === 'gallery' ? 'text-primary' : ''}`}
                  onClick={(e) => {
                    e.preventDefault();
                    const element = document.getElementById('gallery');
                    if (element) {
                      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                    setActiveSection('gallery');
                  }}
                >
                  Gallery
                  {activeSection === 'gallery' && (
                    <motion.span
                      className="absolute bottom-[-4px] left-0 right-0 h-0.5 bg-primary"
                      layoutId="navbar-underline"
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                </a>
              )}
              {isFeatureEnabled('rsvp') && (
                <a
                  href="#rsvp"
                  className={`nav-link relative hover:text-primary transition duration-300 ${activeSection === 'rsvp' ? 'text-primary' : ''}`}
                  onClick={(e) => {
                    e.preventDefault();
                    const element = document.getElementById('rsvp');
                    if (element) {
                      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                    setActiveSection('rsvp');
                  }}
                >
                  RSVP
                  {activeSection === 'rsvp' && (
                    <motion.span
                      className="absolute bottom-[-4px] left-0 right-0 h-0.5 bg-primary"
                      layoutId="navbar-underline"
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                </a>
              )}
            </>
          )}
          {isFeatureEnabled('messages') && (
            <a
              href="#messages"
              className={`nav-link relative hover:text-primary transition duration-300 ${activeSection === 'messages' ? 'text-primary' : ''}`}
              onClick={(e) => {
                e.preventDefault();
                const element = document.getElementById('messages');
                if (element) {
                  element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
                setActiveSection('messages');
              }}
            >
              Wishes
              {activeSection === 'messages' && (
                <motion.span
                  className="absolute bottom-[-4px] left-0 right-0 h-0.5 bg-primary"
                  layoutId="navbar-underline"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
            </a>
          )}
          {isFeatureEnabled('gallery') && (
            <Link href="/gallery" className={`nav-link hover:text-primary transition duration-300 ${location === '/gallery' ? 'text-primary' : ''}`}>Memories</Link>
          )}
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
              <Link
                href="/"
                className={`py-2 border-b border-gray-200 hover:text-primary transition duration-300 ${location === '/' && !activeSection ? 'text-primary' : ''}`}
                onClick={() => {
                  closeMenu();
                  setActiveSection('');
                  // Scroll to top with the same timing pattern to avoid race conditions
                  requestAnimationFrame(() => {
                    setTimeout(() => {
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }, 50);
                  });
                }}
              >
                Home
              </Link>
              {location === '/' && (
                <>
                  <a
                    href="#couple"
                    className={`py-2 border-b border-gray-200 hover:text-primary transition duration-300 ${activeSection === 'couple' ? 'text-primary' : ''}`}
                    onClick={(e) => {
                      e.preventDefault();
                      scrollToSection('couple');
                    }}
                  >
                    Our Story
                  </a>
                  <a
                    href="#details"
                    className={`py-2 border-b border-gray-200 hover:text-primary transition duration-300 ${activeSection === 'details' ? 'text-primary' : ''}`}
                    onClick={(e) => {
                      e.preventDefault();
                      scrollToSection('details');
                    }}
                  >
                    Wedding Details
                  </a>
                  <a
                    href="#gallery"
                    className={`py-2 border-b border-gray-200 hover:text-primary transition duration-300 ${activeSection === 'gallery' ? 'text-primary' : ''}`}
                    onClick={(e) => {
                      e.preventDefault();
                      scrollToSection('gallery');
                    }}
                  >
                    Gallery
                  </a>
                  <a
                    href="#rsvp"
                    className={`py-2 border-b border-gray-200 hover:text-primary transition duration-300 ${activeSection === 'rsvp' ? 'text-primary' : ''}`}
                    onClick={(e) => {
                      e.preventDefault();
                      scrollToSection('rsvp');
                    }}
                  >
                    RSVP
                  </a>
                </>
              )}
              <a
                href="#messages"
                className={`py-2 border-b border-gray-200 hover:text-primary transition duration-300 ${activeSection === 'messages' ? 'text-primary' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  scrollToSection('messages');
                }}
              >
                Wishes
              </a>
              <Link
                href="/gallery"
                className={`py-2 ${location !== '/gallery' ? 'border-b border-gray-200' : ''} hover:text-primary transition duration-300 ${location === '/gallery' ? 'text-primary' : ''}`}
                onClick={closeMenu}
              >
                Memories
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default NavBar;
