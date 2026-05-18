import { createContext, useContext, useState, useMemo } from "react";
import { en, type TranslationKey, interpolate } from "@/locales/en";
import { id } from "@/locales/id";

type Lang = "en" | "id";

const translations: Record<Lang, Record<TranslationKey, string>> = { en, id };

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
      (key: TranslationKey): string =>
        translations[lang][key] ?? translations.en[key],
    [lang]
  );

  const dateLocale = lang === "id" ? "id-ID" : "en-US";

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
