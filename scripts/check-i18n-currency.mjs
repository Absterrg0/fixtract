#!/usr/bin/env node
/**
 * Small, dependency-free self-check for the i18n/currency preference logic.
 *
 * Run: node scripts/check-i18n-currency.mjs
 *
 * It imports the real TypeScript helpers (Node's built-in type stripping plus
 * a tiny `@/` resolver hook), so this checks the shipped code rather than a
 * copy. Keep it focused: preference parsing/URL cleanup and the money
 * formatters' fallbacks/no-conversion guarantees.
 */

import assert from "node:assert/strict";
import { registerHooks } from "node:module";

const root = new URL("../", import.meta.url);
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      return nextResolve(new URL(`${specifier.slice(2)}.ts`, root).href, context);
    }
    return nextResolve(specifier, context);
  },
});

const { parseAcceptLanguage, firstPreferredLocale, countryToLocale, removeLangParam } =
  await import(new URL("../i18n/localeResolution.ts", import.meta.url).href);
const { formatMoney, formatPrice, convertFromEur, resolveRecordCurrency } =
  await import(new URL("../lib/currency/convert.ts", import.meta.url).href);
const { isTransportError } = await import(
  new URL("../lib/apiErrors.ts", import.meta.url).href
);
const { isQuickAddItemIncluded } = await import(
  new URL("../lib/projectWizardValidation.ts", import.meta.url).href
);

let failures = 0;
function check(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`  ✖ ${name}`);
    console.error(`    ${error instanceof Error ? error.message : String(error)}`);
  }
}

function money(amount, currency, locale) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
  }).format(amount);
}

console.log("Accept-Language preference resolution");
check("orders by quality and strips region/script subtags", () => {
  assert.deepEqual(parseAcceptLanguage("en-GB;q=0.4, fr-CA;q=0.9, nl;q=0.7"), [
    "fr",
    "nl",
    "en",
  ]);
});
check("excludes q=0 entries entirely", () => {
  assert.deepEqual(parseAcceptLanguage("fr;q=0, nl;q=0.8, de;q=0"), ["nl"]);
  assert.equal(firstPreferredLocale("fr;q=0, en;q=0"), undefined);
});
check("clamps out-of-range q values instead of trusting them", () => {
  assert.deepEqual(parseAcceptLanguage("nl;q=5, fr;q=-2, en;q=0.5"), ["nl", "en"]);
});
check("ignores malformed q values without dropping the language", () => {
  assert.deepEqual(parseAcceptLanguage("nl;q=abc, fr;q=0.4"), ["nl", "fr"]);
  assert.deepEqual(parseAcceptLanguage("fr;q=0.4.5, en;q=0.2"), ["fr", "en"]);
});
check("keeps header order for equal weights", () => {
  assert.deepEqual(parseAcceptLanguage("fr;q=0.5, nl;q=0.5, en;q=0.5"), [
    "fr",
    "nl",
    "en",
  ]);
});
check("Belgium uses top Accept-Language, then region, then nl", () => {
  assert.equal(countryToLocale("BE", { acceptLanguage: "fr-BE,fr;q=0.9" }), "fr");
  assert.equal(countryToLocale("BE", { acceptLanguage: "en-US,en;q=0.9" }), "nl");
  assert.equal(
    countryToLocale("BE", { acceptLanguage: null, region: "BRU" }),
    "fr"
  );
  assert.equal(countryToLocale("BE", { acceptLanguage: "nl-BE" }), "nl");
});
check("country defaults stay unchanged", () => {
  assert.equal(countryToLocale("NL"), "nl");
  assert.equal(countryToLocale("FR"), "fr");
  assert.equal(countryToLocale("CH", { acceptLanguage: "fr-CH,de;q=0.8" }), "fr");
  assert.equal(countryToLocale("CH", { acceptLanguage: "en-US" }), "en");
  assert.equal(countryToLocale("DE"), "en");
});

console.log("Language-picker URL cleanup");
check("removes lang while preserving other params and the hash", () => {
  assert.equal(
    removeLangParam("/search?lang=fr&q=plumber&page=2#results"),
    "/search?q=plumber&page=2#results"
  );
  assert.equal(removeLangParam("/?lang=fr"), "/");
});
check("leaves URLs without lang unchanged", () => {
  assert.equal(removeLangParam("/blog/article?tag=repair#top"), "/blog/article?tag=repair#top");
});
check("removes every lang occurrence", () => {
  assert.equal(removeLangParam("/x?lang=nl&lang=fr&a=1"), "/x?a=1");
});
check("handles absolute URLs", () => {
  assert.equal(
    removeLangParam("https://fixtract.com/faq?lang=nl#payment"),
    "https://fixtract.com/faq#payment"
  );
});

console.log("Currency formatters");
check("formatPrice converts display amounts with a valid rate", () => {
  assert.equal(
    formatPrice(100, { locale: "nl-BE", currency: "USD", rates: { USD: 1.1 } }),
    money(110, "USD", "nl-BE")
  );
});
check("formatPrice falls back to EUR when the rate is missing/invalid", () => {
  assert.equal(
    formatPrice(100, { locale: "nl-BE", currency: "USD", rates: { USD: 0 } }),
    money(100, "EUR", "nl-BE")
  );
  assert.equal(
    formatPrice(100, { locale: "fr-BE", currency: "GBP", rates: null }),
    money(100, "EUR", "fr-BE")
  );
  assert.equal(
    formatPrice(100, {
      locale: "en-GB",
      currency: "USD",
      rates: { USD: Number.NaN },
    }),
    money(100, "EUR", "en-GB")
  );
});
check("charged amounts stay EUR even when a rate is available", () => {
  assert.equal(
    formatPrice(100, {
      locale: "nl-BE",
      currency: "USD",
      rates: { USD: 1.1 },
      charge: true,
    }),
    money(100, "EUR", "nl-BE")
  );
});
check("formatMoney uses the record currency and never converts", () => {
  assert.equal(formatMoney(100, "GBP", "en-GB"), money(100, "GBP", "en-GB"));
  assert.equal(formatMoney(100, "$", "nl-BE"), money(100, "USD", "nl-BE"));
  assert.equal(formatMoney(100, null, "fr-BE"), money(100, "EUR", "fr-BE"));
  assert.equal(formatMoney(100, "ZZZ", "en-GB"), money(100, "ZZZ", "en-GB"));
  assert.equal(
    formatMoney(100, "ZZ", "en-GB"),
    `ZZ ${new Intl.NumberFormat("en-GB", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(100)}`
  );
});
check("transactional records use their own charge currency, then fallbacks", () => {
  assert.equal(resolveRecordCurrency("GBP", "USD"), "GBP");
  assert.equal(resolveRecordCurrency(undefined, "USD"), "USD");
  assert.equal(resolveRecordCurrency("  ", null), "EUR");
  assert.equal(resolveRecordCurrency(undefined, "€"), "€");
});

console.log("Wizard quick-add canonical names");
check("dedupe recognizes canonical English and legacy translated labels", () => {
  assert.equal(
    isQuickAddItemIncluded(["Site inspection"], "Site inspection", "Inspectie ter plaatse"),
    true
  );
  assert.equal(
    isQuickAddItemIncluded(["Inspectie ter plaatse"], "Site inspection", "Inspectie ter plaatse"),
    true
  );
  assert.equal(
    isQuickAddItemIncluded(["Material calculation"], "Site inspection", "Inspectie ter plaatse"),
    false
  );
  assert.equal(isQuickAddItemIncluded(["Site inspection"], "Site inspection"), true);
});

console.log("Local transport errors");
check("browser fetch/network failures are recognized as local errors", () => {
  assert.equal(isTransportError(new TypeError("Failed to fetch")), true);
  assert.equal(
    isTransportError(new TypeError("NetworkError when attempting to fetch resource.")),
    true
  );
  assert.equal(isTransportError(new TypeError("Load failed")), true);
});
check("backend messages and ordinary errors are not rewritten", () => {
  assert.equal(isTransportError(new Error("Booking is already completed")), false);
  assert.equal(isTransportError(new TypeError("Invalid JSON response")), false);
  assert.equal(isTransportError("Failed to fetch"), false);
});

check("convertFromEur returns the EUR amount when no usable rate exists", () => {
  assert.equal(convertFromEur(100, "USD", { USD: 2 }), 200);
  assert.equal(convertFromEur(100, "USD", {}), 100);
  assert.equal(convertFromEur(100, "USD", { USD: -1 }), 100);
  assert.equal(convertFromEur(100, "USD", { USD: Number.POSITIVE_INFINITY }), 100);
});

if (failures > 0) {
  console.error(`\n${failures} self-check(s) failed.`);
  process.exit(1);
}
console.log("\nself-check OK");
