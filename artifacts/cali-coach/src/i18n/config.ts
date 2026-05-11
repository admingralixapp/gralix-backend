/**
 * i18n/config.ts — i18next initialisation for CaliCoach
 *
 * Lazy-loads locale files from /locales/{lang}/translation.json via HTTP backend.
 * Detects preferred language from localStorage → browser, falls back to English.
 * RTL direction is applied in App.tsx via the onLanguageChanged handler.
 *
 * Regional English variants (en-GB, en-US) are supported for currency localisation.
 * Plain "en" stored from older sessions is migrated to "en-GB" automatically.
 */

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import HttpBackend from "i18next-http-backend";

const basePath = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

i18n
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: "en",
    ns: ["translation"],
    defaultNS: "translation",

    backend: {
      loadPath: `${basePath}/locales/{{lng}}/translation.json`,
    },

    detection: {
      order: ["localStorage", "navigator", "htmlTag"],
      lookupLocalStorage: "calicoach_lang",
      caches: ["localStorage"],
      /**
       * Migrate legacy plain "en" → "en-GB" so existing users get GBP pricing.
       * All other stored codes pass through unchanged.
       */
      convertDetectedLanguage: (lng: string) => (lng === "en" ? "en-GB" : lng),
    },

    interpolation: {
      escapeValue: false,
    },

    react: {
      useSuspense: false,
    },

    saveMissing: false,
  });

export default i18n;
