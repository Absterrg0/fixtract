import {
  DEFAULT_LOCALE,
  type Locale,
  isLocale,
} from "@/i18n/config";

/**
 * Pure locale/currency resolution helpers, used by middleware.
 * No Node/web imports so they work in the edge runtime.
 */

interface ParsedAcceptLanguage {
  lang: string;
  q: number;
}

/** Parse an Accept-Language header into ordered base language codes. */
export function parseAcceptLanguage(
  header: string | null | undefined
): string[] {
  if (!header) return [];
  const parsed: ParsedAcceptLanguage[] = [];
  for (const part of header.split(",")) {
    const [tag, ...params] = part.trim().split(";");
    if (!tag) continue;
    let q = 1;
    for (const param of params) {
      const match = /^q\s*=\s*([\d.]+)\s*$/.exec(param.trim());
      if (match) {
        const value = Number.parseFloat(match[1]);
        if (!Number.isNaN(value)) q = value;
      }
    }
    parsed.push({ lang: tag.trim().toLowerCase(), q });
  }
  return parsed
    .sort((a, b) => b.q - a.q)
    .map(({ lang }) => lang.split("-")[0])
    .filter(Boolean);
}

/** First supported locale (en|nl|fr) in the Accept-Language preference order. */
export function firstPreferredLocale(
  acceptLanguage: string | null | undefined
): Locale | undefined {
  for (const lang of parseAcceptLanguage(acceptLanguage)) {
    if (isLocale(lang)) return lang;
  }
  return undefined;
}

/** Belgian region codes from the x-vercel-ip-country-region header that point
 * to French (Wallonia + Brussels). */
const BELGIUM_FRENCH_REGIONS = new Set([
  "WAL",
  "WBR",
  "WHT",
  "WLG",
  "WLX",
  "WNA",
  "BRU",
]);

/**
 * Country → default locale.
 * NL → nl; FR, LU, MC → fr; BE → Accept-Language if it prefers nl/fr, else the
 * region header (Wallonia/Brussels → fr), else nl; CH is English unless
 * Accept-Language prefers fr; everything else (incl. DE/AT) → en.
 */
export function countryToLocale(
  country: string,
  options?: { acceptLanguage?: string | null; region?: string | null }
): Locale {
  switch (country) {
    case "NL":
      return "nl";
    case "FR":
    case "LU":
    case "MC":
      return "fr";
    case "BE": {
      // "Prefers" means the visitor's TOP Accept-Language choice: a Belgian
      // browser that lists English first (but has no nl/fr preference on top)
      // falls through to the region heuristic below.
      const top = parseAcceptLanguage(options?.acceptLanguage)[0];
      if (top === "nl" || top === "fr") return top;
      const region = (options?.region ?? "").trim().toUpperCase();
      if (region && BELGIUM_FRENCH_REGIONS.has(region)) return "fr";
      return "nl";
    }
    case "CH": {
      for (const lang of parseAcceptLanguage(options?.acceptLanguage)) {
        if (lang === "fr") return "fr";
        break; // only the top preference counts
      }
      return "en";
    }
    default:
      return DEFAULT_LOCALE;
  }
}
