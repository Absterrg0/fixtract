"use client";

import { PREFERENCE_COOKIE_MAX_AGE } from "@/i18n/config";

/**
 * Client-side preference cookies (locale + currency). They are deliberately
 * readable by JS: middleware and server components resolve the next request
 * from them, and the header pickers read/update them without a round trip.
 */
export function setClientCookie(name: string, value: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${PREFERENCE_COOKIE_MAX_AGE}; samesite=lax`;
}

export function readClientCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}
