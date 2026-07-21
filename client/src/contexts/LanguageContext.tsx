import { createContext, useContext, useState, useMemo } from "react";
import { en, type TranslationKey, interpolate } from "@/locales/en";
import { id } from "@/locales/id";
import { CONTENT_REGISTRY } from "@/content/registry";
import { useContentOverrides } from "@/content/useContentOverrides";

type Lang = "en" | "id";

const translations: Record<Lang, Record<TranslationKey, string>> = { en, id };

// Reverse map: flat locale key -> dotted DB key (only bilingual fields with a localeKey).
const LOCALE_KEY_TO_DB_KEY: Partial<Record<TranslationKey, string>> = {};
for (const f of CONTENT_REGISTRY) {
  if (f.bilingual && f.localeKey) LOCALE_KEY_TO_DB_KEY[f.localeKey] = f.key;
}

interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: TranslationKey) => string;
  dateLocale: string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function readLangFromURL(): Lang {
  if (typeof window === "undefined") return "en";
  const param = new URLSearchParams(window.location.search).get("lang");
  return param === "id" ? "id" : "en";
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readLangFromURL);
  const { map } = useContentOverrides();

  const setLang = (next: Lang) => {
    setLangState(next);
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      params.set("lang", next);
      window.history.replaceState({}, "", `${window.location.pathname}?${params.toString()}`);
    }
  };

  const t = useMemo(
    () =>
      (key: TranslationKey): string => {
        const dbKey = LOCALE_KEY_TO_DB_KEY[key];
        if (dbKey) {
          const override = map[lang]?.[dbKey] ?? map.en?.[dbKey];
          if (override) return override;
        }
        return translations[lang][key] ?? translations.en[key];
      },
    [lang, map]
  );

  const dateLocale = lang === "id" ? "id-ID" : "en-GB";

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, dateLocale }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used inside LanguageProvider");
  return ctx;
}

export { interpolate };
