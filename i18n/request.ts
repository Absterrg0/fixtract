import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";

import { GEO_LOCALE_COOKIE } from "@/lib/marketing/siteAnnouncements/constants";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  LOCALE_REQUEST_HEADER,
  type Locale,
  isLocale,
} from "./config";
import { NAMESPACES, type Namespace } from "./namespaces";

/**
 * Messages are split per namespace in `messages/<locale>/<namespace>.json` so
 * parallel workstreams never touch the same file. They are merged here as
 * `{ [namespace]: json }`, i.e. the namespace files contain their keys
 * directly (no namespace wrapper).
 *
 * Translation keys are typed from the English files (see global.d.ts), while
 * this loader stays dynamic so adding a namespace only means adding it to
 * `i18n/namespaces.ts` plus three JSON files.
 */
type MessageTree = Record<string, unknown>;

const messageCache = new Map<string, MessageTree>();

async function loadNamespace(
  locale: Locale,
  namespace: Namespace
): Promise<MessageTree> {
  const cacheKey = `${locale}/${namespace}`;
  const cached = messageCache.get(cacheKey);
  if (cached) return cached;

  // The variable path is intentional: webpack creates one context module for
  // messages/<locale>/<namespace>.json, so all locale bundles are available.
  const loaded = (await import(`../messages/${locale}/${namespace}.json`)) as {
    default: MessageTree;
  };
  messageCache.set(cacheKey, loaded.default);
  return loaded.default;
}

async function loadMessages(locale: Locale): Promise<Record<string, MessageTree>> {
  const entries = await Promise.all(
    NAMESPACES.map(
      async (namespace) =>
        [namespace, await loadNamespace(locale, namespace)] as const
    )
  );
  return Object.fromEntries(entries);
}

/**
 * Resolve the locale for this request. Middleware forwards the fully resolved
 * locale on `x-fixera-locale` (cookies set on the response are not visible to
 * the server render of that same request — headers are). Fallbacks cover
 * contexts where middleware did not run or the header was lost.
 */
async function resolveRequestLocale(): Promise<Locale> {
  const requestHeaders = await headers();
  const headerValue = requestHeaders.get(LOCALE_REQUEST_HEADER);
  if (isLocale(headerValue)) return headerValue;

  const cookieStore = await cookies();
  const localeValue = cookieStore.get(LOCALE_COOKIE)?.value;
  if (isLocale(localeValue)) return localeValue;

  const geoValue = cookieStore.get(GEO_LOCALE_COOKIE)?.value;
  if (isLocale(geoValue)) return geoValue;

  return DEFAULT_LOCALE;
}

export default getRequestConfig(async () => {
  const locale = await resolveRequestLocale();
  return {
    locale,
    messages: await loadMessages(locale),
  };
});
