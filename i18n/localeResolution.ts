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
  order: number;
}

/**
 * Parse a qvalue into a usable 0–1 weight.
 *
 * Malformed values (e.g. `q=abc`, `q=0.5.5`) are ignored so the entry keeps
 * the default weight; numeric out-of-range values are clamped instead of
 * making an entry illegally dominate every other language.
 */
function parseQuality(raw: string): number | undefined {
  const value = raw.trim();
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.min(1, Math.max(0, parsed));
}

/**
 * Parse an Accept-Language header into ordered base language codes.
 * `q=0` means "not acceptable" and is excluded entirely.
 */
export function parseAcceptLanguage(
  header: string | null | undefined
): string[] {
  if (!header) return [];
  const parsed: ParsedAcceptLanguage[] = [];
  for (const [order, part] of header.split(",").entries()) {
    const [tag, ...params] = part.trim().split(";");
    const language = tag.trim().toLowerCase();
    if (!language || language === "*") continue;

    let q = 1;
    for (const param of params) {
      const match = /^q\s*=\s*(.*)$/i.exec(param.trim());
      if (!match) continue;
      const value = parseQuality(match[1]);
      if (value !== undefined) q = value;
    }
    if (q <= 0) continue;
    parsed.push({ lang: language, q, order });
  }
  return parsed
    .sort((a, b) => b.q - a.q || a.order - b.order)
    .map(({ lang }) => lang.split("-")[0])
    .filter(Boolean);
}

/**
 * Removes every `lang` query parameter from a URL while preserving the other
 * params, the hash and (for absolute URLs) the origin. Used by the header
 * language picker so a stale `?lang=` can never override the new manual cookie.
 */
export function removeLangParam(url: string): string {
  if (!url) return url;
  try {
    const absolute = /^[a-z][a-z0-9+.-]*:/i.test(url);
    const parsed = new URL(url, "http://fixera.invalid");
    if (!parsed.searchParams.has("lang")) return url;
    parsed.searchParams.delete("lang");
    return absolute
      ? parsed.toString()
      : `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return url;
  }
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
