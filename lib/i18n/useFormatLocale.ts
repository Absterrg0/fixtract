"use client";

import { useLocale } from "next-intl";
import { dateFnsLocale, intlLocale } from "@/lib/i18n/format";

/** Active locale for client-side date/number formatting. */
export function useFormatLocale() {
  const locale = useLocale();
  return { locale, intl: intlLocale(locale), dateFns: dateFnsLocale(locale) };
}
