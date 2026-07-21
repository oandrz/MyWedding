package handler

// StructuralContentKeys maps non-translated ('*' locale) keys to a validation type.
var StructuralContentKeys = map[string]string{
	"wedding.date":           "date", // RFC3339
	"venue.matrimony.mapUrl": "url",
	"venue.reception.mapUrl": "url",
	"venue.matrimony.time":   "text",
	"venue.reception.time":   "text",
}

// InterpolatedContentKeys maps keys whose value MUST retain interpolation
// tokens (a non-empty override missing a required token is rejected).
var InterpolatedContentKeys = map[string][]string{
	"rsvp.rsvpThankYou":     {"{name}"},
	"messages.seeAllWishes": {"{count}"},
}

// proseContentKeys are bilingual (en/id) text keys — the union of locale keys
// plus migrated literals. Must match client/src/shared registry keys.
var proseContentKeys = []string{
	// HeroSection
	"hero.gettingMarried", "hero.saveTheDate", "hero.rsvpNow",
	"hero.days", "hero.hours", "hero.minutes", "hero.seconds",
	// WelcomeOverlay
	"welcome.openInvitation", "welcome.selectLanguage",
	// DetailsSection
	"details.theDetails", "details.detailsSubtitle", "details.date", "details.schedule",
	"details.location", "details.viewOnMaps", "details.gettingThere",
	"details.rideHailingTitle", "details.rideHailingBody", "details.valetTitle",
	"details.valetBody", "details.weddingDaySchedule",
	// Venue text (bilingual titles/location/address)
	"venue.matrimony.title", "venue.reception.title",
	"venue.location", "venue.address",
	// BibleVerseSection
	"bible.verse", "bible.verseRef",
	// CoupleSection
	"couple.ourLoveStory", "couple.theGroom", "couple.theBride",
	"couple.secondSonOf", "couple.secondDaughterOf", "couple.howWeMet",
	"couple.story1", "couple.story2", "couple.story3", "couple.storyQuote",
	"couple.groomName", "couple.brideName",
	"couple.groomFather", "couple.groomMother",
	"couple.brideFather", "couple.brideMother",
	// DressCodeSection
	"dress.dressCode", "dress.colorToAvoid", "dress.dressCodeSubtitle",
	// GallerySection
	"gallery.ourGallery", "gallery.gallerySubtitle",
	// RsvpSection
	"rsvp.rsvp", "rsvp.rsvpSubtitle", "rsvp.willYouAttend", "rsvp.attendBoth",
	"rsvp.attendHolyMatrimony", "rsvp.attendReception", "rsvp.attendDecline",
	"rsvp.numberOfGuests", "rsvp.submitRsvp", "rsvp.updateRsvp",
	"rsvp.rsvpThankYou", "rsvp.rsvpConfirmAttending", "rsvp.rsvpConfirmDecline",
	// MessagesSection
	"messages.wishesTitle", "messages.wishesSubtitle", "messages.yourName",
	"messages.yourMessage", "messages.sendWish", "messages.noMessages",
	"messages.seeAllWishes", "messages.thankYouMessage",
	// EGiftSection
	"egift.eGiftTitle", "egift.eGiftSubtitle", "egift.groom", "egift.bride",
	"egift.copyAccountNumber", "egift.copied",
	// Footer
	"footer.madeWithLove", "footer.monogram",
	// NavBar
	"nav.home", "nav.ourStory", "nav.weddingDetails", "nav.wishes", "nav.monogram",
}

// AllowedContentKeys is the set of every editable key (prose + structural).
var AllowedContentKeys = func() map[string]bool {
	m := make(map[string]bool, len(proseContentKeys)+len(StructuralContentKeys))
	for _, k := range proseContentKeys {
		m[k] = true
	}
	for k := range StructuralContentKeys {
		m[k] = true
	}
	return m
}()
