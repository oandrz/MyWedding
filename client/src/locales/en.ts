export const en = {
  // WelcomeOverlay
  openInvitation: "Open Invitation",
  selectLanguage: "Select your language",

  // HeroSection
  gettingMarried: "We're Getting Married",
  saveTheDate: "Save the Date",
  rsvpNow: "RSVP Now",
  days: "Days",
  hours: "Hours",
  minutes: "Minutes",
  seconds: "Seconds",

  // DetailsSection
  theDetails: "The Details",
  detailsSubtitle: "Join us as we celebrate our special day",
  date: "Date",
  schedule: "Schedule",
  location: "Location",
  viewOnMaps: "View on Google Maps",
  gettingThere: "Getting There",
  rideHailingTitle: "Ride-Hailing Recommended",
  rideHailingBody: "Due to limited parking space at the venue, we kindly recommend using online ride-hailing services such as Grab or Gojek for a more convenient arrival experience.",
  valetTitle: "Free Valet Parking Service Available",
  valetBody: "For guests who prefer to bring their own car, please be advised that due to the limited parking space, your vehicle will be managed by the venue's valet parking service (Free).",
  weddingDaySchedule: "Wedding Day Schedule",

  // BibleVerseSection
  bibleVerse: "“We love, because He first loved us.”",
  bibleVerseRef: "1 John 4:19",

  // CoupleSection
  ourLoveStory: "Our Love Story",
  theGroom: "The Groom",
  theBride: "The Bride",
  secondSonOf: "the second son of",
  secondDaughterOf: "the second daughter of",
  howWeMet: "How We Met",
  ourStoryParagraph1: "James and Olivia first crossed paths at a friend's birthday dinner. What began as a passing conversation about favorite places to travel quickly turned into hours of talking, long after everyone else had gone home.",
  ourStoryParagraph2: "A casual coffee became a standing weekly date. Neither of them planned for it, but somewhere between shared playlists and late-night calls, a simple friendship grew into something far more meaningful.",
  ourStoryParagraph3: "After several wonderful years together, James asked the question that would change everything — and Olivia said yes. So here we are, making it official and inviting you to be part of our most important day! 😊",
  ourStoryQuote: "“True love stories never have endings.” — Richard Bach",

  // DressCodeSection
  dressCode: "Dress Code",
  colorToAvoid: "Color To Avoid",
  dressCodeSubtitle: "We kindly ask that guest avoid wearing the following colors (Bold and Strong Color) to our celebration. For Example:",

  // GallerySection
  ourGallery: "Our Gallery",
  gallerySubtitle: "Capturing our beautiful moments together",

  // RsvpSection
  rsvp: "RSVP",
  rsvpSubtitle: "We can’t wait to celebrate with you. Please let us know if you’ll be joining us.",
  willYouAttend: "Will You Attend?",
  attendBoth: "Both Ceremonies",
  attendHolyMatrimony: "Holy Matrimony Only",
  attendReception: "Reception Only",
  attendDecline: "Regretfully Decline",
  numberOfGuests: "Number of Guests",
  submitRsvp: "Submit RSVP",
  updateRsvp: "Update RSVP",
  rsvpThankYou: "Thank you, {name}!",
  rsvpConfirmAttending: "We’re looking forward to celebrating with you.",
  rsvpConfirmDecline: "We understand and will miss you.",

  // MessagesSection
  wishesTitle: "Wishes & Messages",
  wishesSubtitle: "Share your heartfelt wishes with us",
  yourName: "Your Name",
  yourMessage: "Your Message",
  sendWish: "Send Your Wish",
  seeAllWishes: "See All {count} Wishes",
  thankYouMessage: "Thank you for your message!",
  noMessages: "Be the first to leave a wish!",

  // EGiftSection
  eGiftTitle: "E-Gift",
  eGiftSubtitle: "Your presence is our greatest gift. However, if you wish to send a token of your love, you may do so through the following:",
  groom: "Groom",
  bride: "Bride",
  copyAccountNumber: "Copy Account Number",
  copied: "Copied!",

  // Footer
  madeWithLove: "Made with love for our special day",
} as const;

export type TranslationKey = keyof typeof en;

export function interpolate(str: string, vars: Record<string, string | number>): string {
  return str.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? `{${key}}`));
}
