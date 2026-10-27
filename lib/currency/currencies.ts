/**
 * Supported display currencies: EUR plus the ECB reference currencies.
 * All prices in the database are EUR — every other currency is DISPLAY ONLY
 * and payments are always charged in EUR.
 */
export const SUPPORTED_CURRENCIES = [
  "EUR",
  "USD",
  "GBP",
  "CHF",
  "PLN",
  "SEK",
  "NOK",
  "DKK",
  "CZK",
  "HUF",
  "RON",
  "TRY",
  "JPY",
  "CNY",
  "AUD",
  "CAD",
  "BRL",
  "MXN",
  "ZAR",
  "INR",
  "HKD",
  "SGD",
  "THB",
  "KRW",
  "NZD",
  "ILS",
  "ISK",
  "IDR",
  "MYR",
  "PHP",
] as const;

export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number];

export const BASE_CURRENCY: CurrencyCode = "EUR";

/** Default display currency when nothing is resolved (unknown geo, no cookie). */
export const DEFAULT_CURRENCY: CurrencyCode = "EUR";

/** Cookie holding the currency suggested by the visitor's IP country
 * (middleware-managed; only used to order the picker's suggestions). */
export const GEO_CURRENCY_COOKIE = "geo_currency";

export function isSupportedCurrency(
  value: string | null | undefined
): value is CurrencyCode {
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(value ?? "");
}

/**
 * Localized display name for a currency code, e.g. "US dollar" for
 * Intl.DisplayNames("nl", { type: "currency" }). Falls back to the code when
 * Intl.DisplayNames is unavailable or rejects the code.
 */
export function localizedName(
  code: string,
  locale: string,
  fallback = code
): string {
  try {
    const displayNames = new Intl.DisplayNames([locale], { type: "currency" });
    return displayNames.of(code) || fallback;
  } catch {
    return fallback;
  }
}
