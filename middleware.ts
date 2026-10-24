import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  GEO_COUNTRY_COOKIE,
  GEO_LOCALE_COOKIE,
} from "@/lib/marketing/siteAnnouncements/constants";
import {
  CURRENCY_COOKIE,
  CURRENCY_REQUEST_HEADER,
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  LOCALE_REQUEST_HEADER,
  PREFERENCE_COOKIE_MAX_AGE,
  type Locale,
  isLocale,
} from "@/i18n/config";
import { countryToLocale, firstPreferredLocale } from "@/i18n/localeResolution";
import {
  GEO_CURRENCY_COOKIE,
  countryToCurrency,
  isSupportedCurrency,
  type CurrencyCode,
} from "@/lib/currency";

/**
 * Locale/currency resolution (Booking.com style, no i18n routing).
 *
 * Locale:   ?lang=xx  >  NEXT_LOCALE cookie  >  geo country (BE via
 *           Accept-Language then x-vercel-ip-country-region, CH via
 *           Accept-Language)  >  Accept-Language  >  en.
 * Currency: NEXT_CURRENCY cookie  >  geo country  >  EUR.
 *
 * The resolved values are forwarded as request headers because cookies set on
 * this response are not visible to the server render of the same request.
 * Cookies are only written when their value changes, so the common case adds
 * no Set-Cookie to the response (keeps responses cache-friendly).
 */

const GEO_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

function setCookieIfChanged(
  response: NextResponse,
  request: NextRequest,
  name: string,
  value: string,
  maxAge: number
) {
  if (request.cookies.get(name)?.value === value) return;
  response.cookies.set(name, value, { path: "/", sameSite: "lax", maxAge });
}

export function middleware(request: NextRequest) {
  // --- Geo country (unchanged consumers: site announcements + CMS filtering) ---
  // Vercel injects x-vercel-ip-country on deployed requests; locally it is absent.
  const vercelCountry = (request.headers.get("x-vercel-ip-country") || "")
    .trim()
    .toUpperCase()
    .slice(0, 2);

  // Dev/local override only — production uses Vercel geo header.
  const allowGeoOverride =
    process.env.NODE_ENV === "development" ||
    request.nextUrl.hostname === "localhost" ||
    request.nextUrl.hostname === "127.0.0.1";
  const queryGeo = allowGeoOverride
    ? request.nextUrl.searchParams.get("geo")?.trim().toUpperCase().slice(0, 2)
    : undefined;
  const existingCountry = request.cookies
    .get(GEO_COUNTRY_COOKIE)
    ?.value?.toUpperCase();

  const country =
    (queryGeo && /^[A-Z]{2}$/.test(queryGeo) && queryGeo) ||
    (vercelCountry && /^[A-Z]{2}$/.test(vercelCountry) && vercelCountry) ||
    (existingCountry && /^[A-Z]{2}$/.test(existingCountry) && existingCountry) ||
    (allowGeoOverride ? "BE" : undefined);

  const acceptLanguage = request.headers.get("accept-language");
  const region = request.headers.get("x-vercel-ip-country-region");

  // Geo-derived locale. Without a country we still honour Accept-Language.
  const geoLocale: Locale = country
    ? countryToLocale(country, { acceptLanguage, region })
    : firstPreferredLocale(acceptLanguage) ?? DEFAULT_LOCALE;

  // --- Locale: explicit ?lang= wins (any environment, and is persisted) ---
  const queryLang = request.nextUrl.searchParams.get("lang");
  const manualLang = isLocale(queryLang) ? queryLang : undefined;
  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
  const locale: Locale =
    manualLang ??
    (isLocale(cookieLocale) ? cookieLocale : undefined) ??
    geoLocale;

  // --- Currency: display only, payments stay in EUR ---
  const geoCurrency: CurrencyCode = countryToCurrency(country);
  const cookieCurrency = request.cookies.get(CURRENCY_COOKIE)?.value;
  const currency: CurrencyCode = isSupportedCurrency(cookieCurrency)
    ? cookieCurrency
    : geoCurrency;

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(LOCALE_REQUEST_HEADER, locale);
  requestHeaders.set(CURRENCY_REQUEST_HEADER, currency);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  if (country) {
    setCookieIfChanged(response, request, GEO_COUNTRY_COOKIE, country, GEO_COOKIE_MAX_AGE);
  }
  // geo_locale is only ever en|nl|fr (consumers assume a supported locale).
  setCookieIfChanged(response, request, GEO_LOCALE_COOKIE, geoLocale, GEO_COOKIE_MAX_AGE);
  setCookieIfChanged(response, request, GEO_CURRENCY_COOKIE, geoCurrency, GEO_COOKIE_MAX_AGE);

  if (manualLang) {
    setCookieIfChanged(response, request, LOCALE_COOKIE, manualLang, PREFERENCE_COOKIE_MAX_AGE);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all paths except static assets and Next internals.
     */
    "/((?!_next/static|_next/image|(?:sw\\.js|manifest\\.webmanifest|offline\\.html|firebase-messaging-sw-config\\.js|favicon\\.ico)$|.*\\.(?:svg|png|jpg|jpeg|gif|webp|webmanifest|ico)$).*)",
  ],
};
