// Wedding Date - July 5, 2026 at 2:00 PM
export const WEDDING_DATE = new Date('July 5, 2026 14:00:00');

// Helper function to format the wedding date
const formatWeddingDate = (): string => {
  const options: Intl.DateTimeFormatOptions = { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  };
  return WEDDING_DATE.toLocaleDateString('en-US', options);
};

export const FORMATTED_WEDDING_DATE = formatWeddingDate();

// Couple Info
export const BRIDE_NAME = "Christine Natasya Serena";
export const GROOM_NAME = "Andreas";

// Wedding Details
export const WEDDING_SCHEDULE = [
  {
    title: "Ceremony",
    time: "2:00 PM - 3:30 PM",
    description: "Exchange of vows and rings in a beautiful ceremony at St. Mary's Cathedral"
  },
  {
    title: "Cocktail Hour",
    time: "4:00 PM - 5:00 PM",
    description: "Enjoy hors d'oeuvres and drinks while the wedding party takes photos"
  },
  {
    title: "Dinner Reception",
    time: "5:30 PM - 7:30 PM",
    description: "Elegant dinner, toasts, and speeches celebrating the newlyweds"
  },
  {
    title: "Dancing & Celebration",
    time: "8:00 PM - 10:00 PM",
    description: "Dance the night away with music, cake cutting, and joyous celebration"
  }
];

// Venue Information
export const VENUES = [
  {
    title: "Ceremony",
    date: FORMATTED_WEDDING_DATE,
    time: "2:00 PM - 3:30 PM",
    location: "Casakhasa Kemang",
    address: "Jl. Kemang Raya, Jakarta Selatan",
    icon: "fas fa-rings-wedding"
  },
  {
    title: "Reception",
    date: FORMATTED_WEDDING_DATE,
    time: "4:30 PM - 10:00 PM",
    location: "Casakhasa Kemang",
    address: "Jl. Kemang Raya, Jakarta Selatan",
    icon: "fas fa-glass-cheers"
  },
  {
    title: "Accommodations",
    date: null,
    time: null,
    location: "Nearby Hotels",
    address: "Kemang Area, Jakarta Selatan",
    icon: "fas fa-hotel"
  }
];

// Gallery Photos
export const GALLERY_PHOTOS = [
  {
    src: "https://images.unsplash.com/photo-1522673607200-164d1b3ce475?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80",
    alt: "Andreas and Christine laughing together"
  },
  {
    src: "https://images.unsplash.com/photo-1494774157365-9e04c6720e47?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80",
    alt: "Holding hands at the beach"
  },
  {
    src: "https://images.unsplash.com/photo-1469371670807-013ccf25f16a?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80",
    alt: "Engagement photo"
  },
  {
    src: "https://images.unsplash.com/photo-1583939003579-730e3918a45a?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80",
    alt: "First date"
  },
  {
    src: "https://images.unsplash.com/photo-1537633552985-df8429e8048b?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80",
    alt: "Vacation together"
  },
  {
    src: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80",
    alt: "Hiking adventure"
  },
  {
    src: "https://images.unsplash.com/photo-1545232979-8bf68ee9b1af?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80",
    alt: "Christmas together"
  },
  {
    src: "https://images.unsplash.com/photo-1530268729831-4b0b9e170218?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80",
    alt: "Proposal moment"
  }
];
