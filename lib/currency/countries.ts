import type { CurrencyCode } from "@/lib/currency/currencies";

/**
 * Country (ISO 3166-1 alpha-2) → default display currency.
 * Anything not listed falls back to EUR, which resolves the whole eurozone
 * (AT BE HR CY EE FI FR DE GR IE IT LV LT LU MT MC NL PT SM SK SI ES VA, AD),
 * plus all unknown countries.
 */
const COUNTRY_TO_CURRENCY: Record<string, CurrencyCode> = {
  // ECB reference currencies outside the eurozone
  GB: "GBP",
  CH: "CHF",
  LI: "CHF",
  US: "USD",
  PL: "PLN",
  SE: "SEK",
  NO: "NOK",
  DK: "DKK",
  CZ: "CZK",
  HU: "HUF",
  RO: "RON",
  TR: "TRY",
  JP: "JPY",
  CN: "CNY",
  AU: "AUD",
  CA: "CAD",
  HK: "HKD",
  SG: "SGD",
  NZ: "NZD",
  IL: "ILS",
  IN: "INR",
  TH: "THB",
  KR: "KRW",
  BR: "BRL",
  MX: "MXN",
  ZA: "ZAR",
  ID: "IDR",
  MY: "MYR",
  PH: "PHP",
  IS: "ISK",
};

export function countryToCurrency(code: string | null | undefined): CurrencyCode {
  const country = code?.trim().toUpperCase();
  if (country && /^[A-Z]{2}$/.test(country)) {
    return COUNTRY_TO_CURRENCY[country] ?? "EUR";
  }
  return "EUR";
}
