import type { Locale as DateFnsLocale } from "date-fns";
import { enGB, fr, nlBE } from "date-fns/locale";
import { INTL_FORMAT_LOCALES, isLocale, type Locale } from "@/i18n/config";

const DATE_FNS_LOCALES: Record<Locale, DateFnsLocale> = {
  en: enGB,
  nl: nlBE,
  fr,
};

/** date-fns locale for an app locale: `format(date, "PPP", { locale: dateFnsLocale(locale) })`. */
export function dateFnsLocale(locale: string): DateFnsLocale {
  return DATE_FNS_LOCALES[isLocale(locale) ? locale : "en"];
}

/** Intl tag for an app locale (nl → nl-BE), for toLocaleDateString / Intl.* calls. */
export function intlLocale(locale: string): string {
  return INTL_FORMAT_LOCALES[isLocale(locale) ? locale : "en"];
}
