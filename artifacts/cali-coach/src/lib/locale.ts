/**
 * locale.ts — Currency detection and locale helpers
 *
 * Currency is derived from the user's chosen i18n language (reactive),
 * falling back to navigator.language for static callers.
 *
 *  en-GB / en-IE             → £ GBP (native price)
 *  hi / bn / mr / ne …       → ₹ INR
 *  Continental Europe         → € EUR
 *  en-US / en-CA / en-AU …   → $ USD
 *  Everything else            → £ GBP
 */

import { useTranslation } from "react-i18next";

export type Currency = "GBP" | "USD" | "EUR" | "INR";

const EUR_LOCALES = new Set([
  "de", "fr", "it", "es", "pt", "nl", "pl", "sv", "da", "no", "fi",
  "cs", "sk", "hu", "ro", "bg", "hr", "sl", "et", "lv", "lt", "mt",
  "el", "ca", "lb", "eu", "gl",
]);

const USD_LOCALES = new Set([
  "en-US", "en-CA", "en-AU", "en-NZ", "en-SG",
]);

const INR_LOCALES = new Set(["hi", "bn", "mr", "ne", "pa", "gu", "te", "kn", "ml", "ta", "or", "as"]);

export function detectCurrencyFromLang(lang: string): Currency {
  if (!lang) return detectCurrency();
  const base = lang.split("-")[0]!.toLowerCase();
  const full = lang.toLowerCase();

  if (full === "en-gb" || full === "en-ie") return "GBP";
  if (INR_LOCALES.has(base)) return "INR";
  if (EUR_LOCALES.has(base)) return "EUR";
  if (USD_LOCALES.has(full) || (base === "en" && !full.startsWith("en-gb"))) return "USD";
  return "USD";
}

export function detectCurrency(): Currency {
  return detectCurrencyFromLang(navigator.language ?? "en-GB");
}

interface PriceSet {
  monthly: string;
  yearly: string;
  pack: string;
  symbol: string;
}

const PRICES: Record<Currency, PriceSet> = {
  GBP: { symbol: "£", monthly: "£14.99",  yearly: "£149.99",  pack: "£4.99"  },
  USD: { symbol: "$", monthly: "$18.99",  yearly: "$189.99",  pack: "$6.49"  },
  EUR: { symbol: "€", monthly: "€17.99",  yearly: "€174.99",  pack: "€5.99"  },
  INR: { symbol: "₹", monthly: "₹1,499",  yearly: "₹14,999",  pack: "₹499"   },
};

/**
 * React hook — returns prices for the user's currently selected language.
 * Re-renders automatically when the language changes.
 */
export function useLocalizedPrices(): PriceSet {
  const { i18n } = useTranslation();
  return PRICES[detectCurrencyFromLang(i18n.language)];
}

/**
 * Format a numeric GBP amount into the currency that matches `lang`.
 * Pass `i18n.language` from a component to get a reactive result.
 */
export function formatCurrency(amount: number, lang?: string): string {
  const currency = lang ? detectCurrencyFromLang(lang) : detectCurrency();
  const { symbol } = PRICES[currency];
  if (currency === "INR") {
    return `${symbol}${Math.round(amount * 100).toLocaleString("en-IN")}`;
  }
  return `${symbol}${amount.toFixed(2)}`;
}

export function localizePackPrice(gbpPrice: string, lang: string): string {
  const amount = parseFloat(gbpPrice.replace(/[^0-9.]/g, ""));
  if (isNaN(amount) || amount === 0) return gbpPrice;
  return PRICES[detectCurrencyFromLang(lang)].pack;
}
