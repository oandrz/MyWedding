import type { TranslationKey } from "@/locales/en";

export type ContentFieldType = "text" | "textarea" | "date" | "time" | "url";

export interface ContentField {
  section: string;
  key: string;           // DB key, e.g. "hero.saveTheDate"
  label: string;         // admin label
  type: ContentFieldType;
  bilingual: boolean;    // true => en+id rows; false => '*' row
  localeKey?: TranslationKey; // compiled default source (bilingual prose only)
}

export const CONTENT_REGISTRY: ContentField[] = [
  // Hero
  { section: "Hero", key: "hero.gettingMarried", label: "“We're Getting Married”", type: "text", bilingual: true, localeKey: "gettingMarried" },
  { section: "Hero", key: "hero.saveTheDate", label: "Save the Date button", type: "text", bilingual: true, localeKey: "saveTheDate" },
  { section: "Hero", key: "hero.rsvpNow", label: "RSVP Now button", type: "text", bilingual: true, localeKey: "rsvpNow" },
  { section: "Hero", key: "hero.days", label: "Countdown “Days”", type: "text", bilingual: true, localeKey: "days" },
  { section: "Hero", key: "hero.hours", label: "Countdown “Hours”", type: "text", bilingual: true, localeKey: "hours" },
  { section: "Hero", key: "hero.minutes", label: "Countdown “Minutes”", type: "text", bilingual: true, localeKey: "minutes" },
  { section: "Hero", key: "hero.seconds", label: "Countdown “Seconds”", type: "text", bilingual: true, localeKey: "seconds" },

  // Welcome overlay
  { section: "Welcome", key: "welcome.openInvitation", label: "Open Invitation button", type: "text", bilingual: true, localeKey: "openInvitation" },
  { section: "Welcome", key: "welcome.selectLanguage", label: "“Select your language”", type: "text", bilingual: true, localeKey: "selectLanguage" },

  // Details
  { section: "Details", key: "details.theDetails", label: "Section title", type: "text", bilingual: true, localeKey: "theDetails" },
  { section: "Details", key: "details.detailsSubtitle", label: "Subtitle", type: "textarea", bilingual: true, localeKey: "detailsSubtitle" },
  { section: "Details", key: "details.date", label: "“Date” label", type: "text", bilingual: true, localeKey: "date" },
  { section: "Details", key: "details.schedule", label: "“Schedule” label", type: "text", bilingual: true, localeKey: "schedule" },
  { section: "Details", key: "details.location", label: "“Location” label", type: "text", bilingual: true, localeKey: "location" },
  { section: "Details", key: "details.viewOnMaps", label: "View on Maps link", type: "text", bilingual: true, localeKey: "viewOnMaps" },
  { section: "Details", key: "details.gettingThere", label: "Getting There title", type: "text", bilingual: true, localeKey: "gettingThere" },
  { section: "Details", key: "details.rideHailingTitle", label: "Ride-hailing title", type: "text", bilingual: true, localeKey: "rideHailingTitle" },
  { section: "Details", key: "details.rideHailingBody", label: "Ride-hailing body", type: "textarea", bilingual: true, localeKey: "rideHailingBody" },
  { section: "Details", key: "details.valetTitle", label: "Valet title", type: "text", bilingual: true, localeKey: "valetTitle" },
  { section: "Details", key: "details.valetBody", label: "Valet body", type: "textarea", bilingual: true, localeKey: "valetBody" },
  { section: "Details", key: "details.weddingDaySchedule", label: "Schedule heading", type: "text", bilingual: true, localeKey: "weddingDaySchedule" },

  // Bible
  { section: "Bible Verse", key: "bible.verse", label: "Verse text", type: "textarea", bilingual: true, localeKey: "bibleVerse" },
  { section: "Bible Verse", key: "bible.verseRef", label: "Verse reference", type: "text", bilingual: true, localeKey: "bibleVerseRef" },

  // Couple (existing locale-backed)
  { section: "Couple", key: "couple.ourLoveStory", label: "“Our Love Story”", type: "text", bilingual: true, localeKey: "ourLoveStory" },
  { section: "Couple", key: "couple.theGroom", label: "“The Groom”", type: "text", bilingual: true, localeKey: "theGroom" },
  { section: "Couple", key: "couple.theBride", label: "“The Bride”", type: "text", bilingual: true, localeKey: "theBride" },
  { section: "Couple", key: "couple.secondSonOf", label: "“the second son of”", type: "text", bilingual: true, localeKey: "secondSonOf" },
  { section: "Couple", key: "couple.secondDaughterOf", label: "“the second daughter of”", type: "text", bilingual: true, localeKey: "secondDaughterOf" },
  { section: "Couple", key: "couple.howWeMet", label: "“How We Met”", type: "text", bilingual: true, localeKey: "howWeMet" },
  { section: "Couple", key: "couple.story1", label: "Story paragraph 1", type: "textarea", bilingual: true, localeKey: "ourStoryParagraph1" },
  { section: "Couple", key: "couple.story2", label: "Story paragraph 2", type: "textarea", bilingual: true, localeKey: "ourStoryParagraph2" },
  { section: "Couple", key: "couple.story3", label: "Story paragraph 3", type: "textarea", bilingual: true, localeKey: "ourStoryParagraph3" },
  { section: "Couple", key: "couple.storyQuote", label: "Story quote", type: "text", bilingual: true, localeKey: "ourStoryQuote" },
  // Couple — migrated literals (localeKey added in Task 11)
  { section: "Couple", key: "couple.groomName", label: "Groom display name", type: "text", bilingual: true, localeKey: "groomName" },
  { section: "Couple", key: "couple.brideName", label: "Bride display name", type: "text", bilingual: true, localeKey: "brideName" },
  { section: "Couple", key: "couple.groomFather", label: "Groom's father", type: "text", bilingual: true, localeKey: "groomFather" },
  { section: "Couple", key: "couple.groomMother", label: "Groom's mother", type: "text", bilingual: true, localeKey: "groomMother" },
  { section: "Couple", key: "couple.brideFather", label: "Bride's father", type: "text", bilingual: true, localeKey: "brideFather" },
  { section: "Couple", key: "couple.brideMother", label: "Bride's mother", type: "text", bilingual: true, localeKey: "brideMother" },

  // Dress code
  { section: "Dress Code", key: "dress.dressCode", label: "Section title", type: "text", bilingual: true, localeKey: "dressCode" },
  { section: "Dress Code", key: "dress.colorToAvoid", label: "“Color To Avoid”", type: "text", bilingual: true, localeKey: "colorToAvoid" },
  { section: "Dress Code", key: "dress.dressCodeSubtitle", label: "Subtitle", type: "textarea", bilingual: true, localeKey: "dressCodeSubtitle" },

  // Gallery
  { section: "Gallery", key: "gallery.ourGallery", label: "Section title", type: "text", bilingual: true, localeKey: "ourGallery" },
  { section: "Gallery", key: "gallery.gallerySubtitle", label: "Subtitle", type: "text", bilingual: true, localeKey: "gallerySubtitle" },

  // RSVP
  { section: "RSVP", key: "rsvp.rsvp", label: "Section title", type: "text", bilingual: true, localeKey: "rsvp" },
  { section: "RSVP", key: "rsvp.rsvpSubtitle", label: "Subtitle", type: "textarea", bilingual: true, localeKey: "rsvpSubtitle" },
  { section: "RSVP", key: "rsvp.willYouAttend", label: "“Will You Attend?”", type: "text", bilingual: true, localeKey: "willYouAttend" },
  { section: "RSVP", key: "rsvp.attendBoth", label: "Both ceremonies option", type: "text", bilingual: true, localeKey: "attendBoth" },
  { section: "RSVP", key: "rsvp.attendHolyMatrimony", label: "Holy Matrimony option", type: "text", bilingual: true, localeKey: "attendHolyMatrimony" },
  { section: "RSVP", key: "rsvp.attendReception", label: "Reception option", type: "text", bilingual: true, localeKey: "attendReception" },
  { section: "RSVP", key: "rsvp.attendDecline", label: "Decline option", type: "text", bilingual: true, localeKey: "attendDecline" },
  { section: "RSVP", key: "rsvp.numberOfGuests", label: "“Number of Guests”", type: "text", bilingual: true, localeKey: "numberOfGuests" },
  { section: "RSVP", key: "rsvp.submitRsvp", label: "Submit button", type: "text", bilingual: true, localeKey: "submitRsvp" },
  { section: "RSVP", key: "rsvp.updateRsvp", label: "Update button", type: "text", bilingual: true, localeKey: "updateRsvp" },
  { section: "RSVP", key: "rsvp.rsvpThankYou", label: "Thank-you (keep {name})", type: "text", bilingual: true, localeKey: "rsvpThankYou" },
  { section: "RSVP", key: "rsvp.rsvpConfirmAttending", label: "Attending confirmation", type: "textarea", bilingual: true, localeKey: "rsvpConfirmAttending" },
  { section: "RSVP", key: "rsvp.rsvpConfirmDecline", label: "Decline confirmation", type: "textarea", bilingual: true, localeKey: "rsvpConfirmDecline" },

  // Messages
  { section: "Messages", key: "messages.wishesTitle", label: "Section title", type: "text", bilingual: true, localeKey: "wishesTitle" },
  { section: "Messages", key: "messages.wishesSubtitle", label: "Subtitle", type: "text", bilingual: true, localeKey: "wishesSubtitle" },
  { section: "Messages", key: "messages.yourName", label: "“Your Name”", type: "text", bilingual: true, localeKey: "yourName" },
  { section: "Messages", key: "messages.yourMessage", label: "“Your Message”", type: "text", bilingual: true, localeKey: "yourMessage" },
  { section: "Messages", key: "messages.sendWish", label: "Send button", type: "text", bilingual: true, localeKey: "sendWish" },
  { section: "Messages", key: "messages.noMessages", label: "Empty state", type: "text", bilingual: true, localeKey: "noMessages" },
  { section: "Messages", key: "messages.seeAllWishes", label: "See-all (keep {count})", type: "text", bilingual: true, localeKey: "seeAllWishes" },
  { section: "Messages", key: "messages.thankYouMessage", label: "Message thank-you", type: "text", bilingual: true, localeKey: "thankYouMessage" },

  // E-Gift
  { section: "E-Gift", key: "egift.eGiftTitle", label: "Section title", type: "text", bilingual: true, localeKey: "eGiftTitle" },
  { section: "E-Gift", key: "egift.eGiftSubtitle", label: "Subtitle", type: "textarea", bilingual: true, localeKey: "eGiftSubtitle" },
  { section: "E-Gift", key: "egift.groom", label: "“Groom” label", type: "text", bilingual: true, localeKey: "groom" },
  { section: "E-Gift", key: "egift.bride", label: "“Bride” label", type: "text", bilingual: true, localeKey: "bride" },
  { section: "E-Gift", key: "egift.copyAccountNumber", label: "Copy-account button", type: "text", bilingual: true, localeKey: "copyAccountNumber" },
  { section: "E-Gift", key: "egift.copied", label: "“Copied!” toast", type: "text", bilingual: true, localeKey: "copied" },

  // Footer
  { section: "Footer", key: "footer.madeWithLove", label: "Footer text", type: "text", bilingual: true, localeKey: "madeWithLove" },
  { section: "Footer", key: "footer.monogram", label: "Monogram (e.g. A&C)", type: "text", bilingual: true, localeKey: "footerMonogram" },

  // Nav (migrated literals; localeKey added in Task 11)
  { section: "Navigation", key: "nav.home", label: "Home", type: "text", bilingual: true, localeKey: "navHome" },
  { section: "Navigation", key: "nav.ourStory", label: "Our Story", type: "text", bilingual: true, localeKey: "navOurStory" },
  { section: "Navigation", key: "nav.weddingDetails", label: "Wedding Details", type: "text", bilingual: true, localeKey: "navWeddingDetails" },
  { section: "Navigation", key: "nav.wishes", label: "Wishes", type: "text", bilingual: true, localeKey: "navWishes" },
  { section: "Navigation", key: "nav.monogram", label: "Nav monogram", type: "text", bilingual: true, localeKey: "navMonogram" },

  // Venue text (migrated literals)
  { section: "Venue", key: "venue.location", label: "Venue name", type: "text", bilingual: true },
  { section: "Venue", key: "venue.address", label: "Venue address", type: "textarea", bilingual: true },

  // Structural (non-translated)
  { section: "Wedding Data", key: "wedding.date", label: "Wedding date & time", type: "date", bilingual: false },
  { section: "Wedding Data", key: "venue.matrimony.mapUrl", label: "Matrimony map URL", type: "url", bilingual: false },
];

export const CONTENT_SECTIONS: string[] = Array.from(
  new Set(CONTENT_REGISTRY.map((f) => f.section))
);
