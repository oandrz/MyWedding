import { WEDDING_DATE, VENUES } from "@/lib/constants";
import { useContentOverrides, type OverrideMap } from "./useContentOverrides";
import { useLanguage } from "@/contexts/LanguageContext";

export interface VenueConfig {
  key: "matrimony" | "reception";
  title: string;
  time: string;
  location: string;
  address: string;
  mapUrl: string;
  icon: string;
}

// Existing hardcoded "View on Maps" link from DetailsSection.tsx (~line 139), kept as the
// default for both venues (both events are at the same location today). Note: the iframe
// embed src (~line 168, a distinct `.../maps/embed?pb=...` string) is NOT represented here —
// the VenueConfig schema has a single mapUrl per venue, and this field is admin-editable
// (type: "url" in the content registry), which fits a normal pasteable Google Maps link far
// better than a hand-unfriendly embed pb= string. Phase 3 wiring must decide how/whether the
// inline map iframe is retained.
const DEFAULT_MAP_URLS: Record<"matrimony" | "reception", string> = {
  matrimony:
    "https://www.google.com/maps/place/Casakhasa/@-6.2594469,106.8204341,17z/data=!3m1!4b1!4m9!3m8!1s0x2e69f22adf2c9a27:0x118d6eaa20e4454b!5m2!4m1!1i2!8m2!3d-6.2594469!4d106.8204341!16s%2Fg%2F11bccm83__",
  reception:
    "https://www.google.com/maps/place/Casakhasa/@-6.2594469,106.8204341,17z/data=!3m1!4b1!4m9!3m8!1s0x2e69f22adf2c9a27:0x118d6eaa20e4454b!5m2!4m1!1i2!8m2!3d-6.2594469!4d106.8204341!16s%2Fg%2F11bccm83__",
};

function pick(map: OverrideMap, lang: string, key: string, fallback: string): string {
  return map[lang]?.[key] ?? map.en?.[key] ?? map["*"]?.[key] ?? fallback;
}

export function parseWeddingConfig(map: OverrideMap, lang = "en"): {
  weddingDate: Date;
  venues: VenueConfig[];
} {
  // Wedding date (structural, '*').
  let weddingDate = WEDDING_DATE;
  const rawDate = map["*"]?.["wedding.date"];
  if (rawDate) {
    const parsed = new Date(rawDate);
    if (!Number.isNaN(parsed.getTime())) weddingDate = parsed;
  }

  const venues: VenueConfig[] = [
    {
      key: "matrimony",
      title: pick(map, lang, "venue.matrimony.title", VENUES[0].title),
      time: map["*"]?.["venue.matrimony.time"] ?? VENUES[0].time,
      location: pick(map, lang, "venue.location", VENUES[0].location),
      address: pick(map, lang, "venue.address", VENUES[0].address),
      mapUrl: map["*"]?.["venue.matrimony.mapUrl"] ?? DEFAULT_MAP_URLS.matrimony,
      icon: VENUES[0].icon,
    },
    {
      key: "reception",
      title: pick(map, lang, "venue.reception.title", VENUES[1].title),
      time: map["*"]?.["venue.reception.time"] ?? VENUES[1].time,
      location: pick(map, lang, "venue.location", VENUES[1].location),
      address: pick(map, lang, "venue.address", VENUES[1].address),
      mapUrl: map["*"]?.["venue.reception.mapUrl"] ?? DEFAULT_MAP_URLS.reception,
      icon: VENUES[1].icon,
    },
  ];

  return { weddingDate, venues };
}

export function useWeddingConfig() {
  const { map } = useContentOverrides();
  const { lang } = useLanguage();
  return parseWeddingConfig(map, lang);
}
