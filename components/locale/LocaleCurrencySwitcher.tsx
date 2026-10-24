"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Check, ChevronDown } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCurrency } from "@/contexts/CurrencyContext";
import { LOCALE_COOKIE, LOCALES, type Locale, isLocale } from "@/i18n/config";
import { GEO_LOCALE_COOKIE } from "@/lib/marketing/siteAnnouncements/constants";
import {
  GEO_CURRENCY_COOKIE,
  SUPPORTED_CURRENCIES,
  type CurrencyCode,
  isSupportedCurrency,
  localizedName,
} from "@/lib/currency/currencies";
import { readClientCookie, setClientCookie } from "@/lib/preferences/cookies";
import { cn } from "@/lib/utils";

/** Native language names as shown in the picker (never translated). */
const LOCALE_NATIVE_NAMES: Record<Locale, string> = {
  en: "English",
  nl: "Nederlands",
  fr: "Français",
};

/** Emoji flags only — no extra dependency, degrades to the country code. */
const LOCALE_FLAGS: Record<Locale, string> = {
  en: "🇬🇧",
  nl: "🇳🇱",
  fr: "🇫🇷",
};

const SUGGESTED_CURRENCIES: CurrencyCode[] = ["EUR", "USD", "GBP", "CHF"];

function dedupeCurrencies(values: Array<string | null | undefined>): CurrencyCode[] {
  const out: CurrencyCode[] = [];
  for (const value of values) {
    if (isSupportedCurrency(value) && !out.includes(value)) out.push(value);
  }
  return out;
}

function dedupeLocales(values: Array<string | null | undefined>): Locale[] {
  const out: Locale[] = [];
  for (const value of values) {
    if (isLocale(value) && !out.includes(value)) out.push(value);
  }
  return out;
}

function Flag({ locale, className }: { locale: Locale; className?: string }) {
  return (
    <span aria-hidden className={cn("text-lg leading-none", className)}>
      {LOCALE_FLAGS[locale]}
    </span>
  );
}

function ChoiceTile({
  selected,
  onSelect,
  className,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
        selected
          ? "border-blue-600 bg-blue-50/60 text-blue-700"
          : "border-gray-200 hover:border-gray-300 hover:bg-gray-50",
        className
      )}
    >
      {children}
      {selected && <Check className="h-4 w-4 shrink-0 text-blue-600" aria-hidden />}
    </button>
  );
}

/**
 * Booking.com-style language + currency pickers for the header.
 * `variant="mobile"` renders the same controls as full-width menu rows.
 */
export default function LocaleCurrencySwitcher({
  variant = "desktop",
  className,
}: {
  variant?: "desktop" | "mobile";
  className?: string;
}) {
  const t = useTranslations("localeSwitcher");
  const locale = useLocale();
  const router = useRouter();
  const { currency, setCurrency } = useCurrency();
  const [, startTransition] = useTransition();
  const [languageOpen, setLanguageOpen] = useState(false);
  const [currencyOpen, setCurrencyOpen] = useState(false);

  // Read inside handlers/memo: cookies are not available during SSR.
  const suggestedLocales = useMemo(
    () => dedupeLocales([readClientCookie(GEO_LOCALE_COOKIE), locale]),
    [locale]
  );
  const suggestedCurrencies = useMemo(
    () =>
      dedupeCurrencies([
        readClientCookie(GEO_CURRENCY_COOKIE),
        currency,
        ...SUGGESTED_CURRENCIES,
      ]),
    [currency]
  );
  const allCurrencies = useMemo(
    () =>
      [...SUPPORTED_CURRENCIES].sort((a, b) => {
        if (a === "EUR") return -1;
        if (b === "EUR") return 1;
        return localizedName(a, locale).localeCompare(localizedName(b, locale), locale);
      }),
    [locale]
  );

  const chooseLanguage = (next: Locale) => {
    if (next === locale) {
      setLanguageOpen(false);
      return;
    }
    setClientCookie(LOCALE_COOKIE, next);
    setLanguageOpen(false);
    startTransition(() => router.refresh());
  };

  const chooseCurrency = (next: CurrencyCode) => {
    setCurrency(next);
    setCurrencyOpen(false);
    startTransition(() => router.refresh());
  };

  const languageTile = (code: Locale) => (
    <ChoiceTile key={code} selected={code === locale} onSelect={() => chooseLanguage(code)}>
      <span className="flex items-center gap-2.5">
        <Flag locale={code} />
        <span className="text-sm font-medium">{LOCALE_NATIVE_NAMES[code]}</span>
      </span>
    </ChoiceTile>
  );

  const currencyTile = (code: CurrencyCode) => (
    <ChoiceTile key={code} selected={code === currency} onSelect={() => chooseCurrency(code)}>
      <span className="flex flex-col">
        <span className="text-sm font-medium">{localizedName(code, locale)}</span>
        <span className="text-xs text-muted-foreground">{code}</span>
      </span>
    </ChoiceTile>
  );

  return (
    <div
      className={cn(
        variant === "mobile" ? "flex flex-col gap-2" : "flex items-center gap-1",
        className
      )}
    >
      {variant === "mobile" ? (
        <>
          <button
            type="button"
            onClick={() => setCurrencyOpen(true)}
            aria-label={t("openCurrency")}
            className="flex w-full items-center justify-between rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-50"
          >
            <span>{t("currency")}</span>
            <span className="flex items-center gap-1.5 text-gray-600">
              {currency}
              <ChevronDown className="h-4 w-4" aria-hidden />
            </span>
          </button>
          <button
            type="button"
            onClick={() => setLanguageOpen(true)}
            aria-label={t("openLanguage")}
            className="flex w-full items-center justify-between rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-50"
          >
            <span>{t("language")}</span>
            <span className="flex items-center gap-1.5 text-gray-600">
              <Flag locale={locale} />
              {LOCALE_NATIVE_NAMES[locale]}
              <ChevronDown className="h-4 w-4" aria-hidden />
            </span>
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setCurrencyOpen(true)}
            aria-label={t("openCurrency")}
            className="flex h-9 items-center gap-1 rounded-md px-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
          >
            {currency}
            <ChevronDown className="h-3.5 w-3.5 text-gray-500" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setLanguageOpen(true)}
            aria-label={t("openLanguage")}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-base transition-colors hover:bg-gray-100"
          >
            <Flag locale={locale} />
          </button>
        </>
      )}

      {/* --- Language dialog --- */}
      <Dialog open={languageOpen} onOpenChange={setLanguageOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("chooseLanguageTitle")}</DialogTitle>
            <DialogDescription>{t("chooseLanguageDescription")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <section>
              <h3 className="mb-2 text-sm font-semibold text-gray-900">{t("suggestedForYou")}</h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {suggestedLocales.map(languageTile)}
              </div>
            </section>
            <section>
              <h3 className="mb-2 text-sm font-semibold text-gray-900">{t("allLanguages")}</h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {LOCALES.map(languageTile)}
              </div>
            </section>
          </div>
        </DialogContent>
      </Dialog>

      {/* --- Currency dialog --- */}
      <Dialog open={currencyOpen} onOpenChange={setCurrencyOpen}>
        <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col">
          <DialogHeader>
            <DialogTitle>{t("selectCurrencyTitle")}</DialogTitle>
            <DialogDescription>{t("selectCurrencyDescription")}</DialogDescription>
          </DialogHeader>

          <div className="-mr-2 min-h-0 space-y-5 overflow-y-auto pr-2">
            <section>
              <h3 className="mb-2 text-sm font-semibold text-gray-900">{t("suggestedForYou")}</h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {suggestedCurrencies.map(currencyTile)}
              </div>
            </section>
            <section>
              <h3 className="mb-2 text-sm font-semibold text-gray-900">{t("allCurrencies")}</h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {allCurrencies.map(currencyTile)}
              </div>
            </section>
            <p className="rounded-lg bg-gray-50 p-3 text-xs leading-relaxed text-gray-600">
              {t("currencyNote")}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
