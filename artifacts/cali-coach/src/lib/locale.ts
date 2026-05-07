/**
 * locale.ts — Currency detection and locale helpers
 *
 * Currency rules:
 *  - British Isles (en-GB, en-IE)          → £ GBP (native price)
 *  - Continental Europe (de, fr, it, es…)  → € EUR (approximate)
 *  - North America / Oceania (en-US etc.)  → $ USD (approximate)
 *  - Everything else                        → £ GBP (display as-is)
 */

export type Currency = "GBP" | "USD" | "EUR";

const EUR_LOCALES = new Set([
  "de", "fr", "it", "es", "pt", "nl", "pl", "sv", "da", "no", "fi",
  "cs", "sk", "hu", "ro", "bg", "hr", "sl", "et", "lv", "lt", "mt",
  "el", "ca", "lb", "eu", "gl",
]);

const USD_LOCALES = new Set([
  "en-US", "en-CA", "en-AU", "en-NZ", "en-SG",
]);

export function detectCurrency(): Currency {
  const loc = navigator.language ?? "en-GB";
  const base = loc.split("-")[0].toLowerCase();
  const full = loc.toLowerCase();

  if (full === "en-gb" || full === "en-ie") return "GBP";
  if (USD_LOCALES.has(full) || (base === "en" && !full.startsWith("en-gb"))) return "USD";
  if (EUR_LOCALES.has(base)) return "EUR";
  return "GBP";
}

interface PriceSet {
  monthly: string;
  yearly: string;
  pack: string;
  symbol: string;
}

const PRICES: Record<Currency, PriceSet> = {
  GBP: { symbol: "£", monthly: "£14.99", yearly: "£149.99", pack: "£4.99" },
  USD: { symbol: "$", monthly: "$18.99", yearly: "$189.99", pack: "$6.49" },
  EUR: { symbol: "€", monthly: "€17.99", yearly: "€174.99", pack: "€5.99" },
};

export function useLocalizedPrices(): PriceSet {
  return PRICES[detectCurrency()];
}

export function localizePackPrice(gbpPrice: string, currency: Currency): string {
  if (currency === "GBP") return gbpPrice;
  const amount = parseFloat(gbpPrice.replace(/[^0-9.]/g, ""));
  if (isNaN(amount)) return gbpPrice;
  if (amount === 0) return PRICES[currency].symbol + "0.00";
  return PRICES[currency].pack;
}
