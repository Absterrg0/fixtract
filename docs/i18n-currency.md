# i18n & currency (frontend)

Booking.com-style localization: the URL never changes, there is **no `/[locale]`
segment**. Language and display currency are resolved per request from the URL,
cookies, geo headers and `Accept-Language`.

Languages: `en` (default), `nl` (informal je/jij), `fr` (vous).
Country/currency audience: Belgium, Netherlands, France (+ any visitor, via geo).
Admin panel (`app/(pages)/admin/**`, `components/admin/**`) **stays English** —
never add translations there.

## How the values are resolved

`middleware.ts` resolves both values and forwards them on request headers
(`x-fixera-locale`, `x-fixera-currency`) because cookies set on a response are
not visible to the server render of that same request.

Locale order:

1. `?lang=xx` (validated, also persists `NEXT_LOCALE` for 1 year)
2. `NEXT_LOCALE` cookie (manual choice, 1 year)
3. geo country: `NL→nl`, `FR/LU/MC→fr`, `BE→` top `Accept-Language` if it is
   nl/fr, else Wallonia/Brussels region header → fr, else nl; `CH→` top
   `Accept-Language` fr, else en; everything else → `en`
4. `Accept-Language` (when there is no geo country)
5. `en`

Currency order: `NEXT_CURRENCY` → geo country (`lib/currency/countries.ts`) → `EUR`.

Middleware also keeps the legacy geo cookies for their existing consumers:
`fixera_geo_country`, `fixera_geo_locale` (always `en|nl|fr`) and `geo_currency`.

Server code reads the resolved values with `getLocale()` (next-intl) or
`getActiveCurrency()` (`lib/currency/server.ts`).

## Messages: one file per namespace

```
messages/<locale>/<namespace>.json     # content is NOT wrapped in the namespace
i18n/namespaces.ts                     # the list of namespaces
i18n/request.ts                        # merges them as { [namespace]: json }
i18n/global.d.ts                       # next-intl AppConfig typing (from en files)
scripts/check-i18n.mjs                 # npm run i18n:check
```

Adding a namespace:

1. Add the name to `i18n/namespaces.ts`.
2. Create `messages/en/<namespace>.json`, `nl/...`, `fr/...` with identical keys.
3. Add the import + entry in `i18n/global.d.ts` (so `tsc` validates keys).
4. `npm run i18n:check`.

`npm run i18n:check` fails when a namespace file is missing, when nl/fr keys
differ from en, when ICU placeholders (`{name}`) differ, or when
`i18n/global.d.ts` was not updated.

## Translating a component

Server component:

```tsx
import { getTranslations } from "next-intl/server";

export default async function Hero() {
  const t = await getTranslations("nav");
  return <h1>{t("forProfessionals")}</h1>;
}
```

Client component:

```tsx
"use client";
import { useTranslations } from "next-intl";

export function Menu() {
  const t = useTranslations("nav");
  return <button>{t("openMenu")}</button>;
}
```

`NextIntlClientProvider` is wired in `app/layout.tsx`, so client components just
work. Use `t("key", { count })` for ICU plurals; never concatenate translated
sentences. Keep brand names ("Fixtract"), external brand names and admin-only UI
untranslated.

## Prices

All DB prices are EUR. Conversion is **display only**; payments, checkout,
invoices and emails are always charged in EUR.

Client components (inside `CurrencyProvider`, i.e. the whole app tree):

```tsx
"use client";
import { useCurrency } from "@/contexts/CurrencyContext";

export function Price({ amount }: { amount: number }) {
  const { formatPrice, currency, convertFromEur } = useCurrency();
  return (
    <p>
      {formatPrice(amount)}            {/* converted + localized, EUR fallback */}
      <span className="sr-only">{currency}</span>
    </p>
  );
}
```

`useCurrency()` returns:

| Field | Type | Notes |
| --- | --- | --- |
| `currency` | `CurrencyCode` | active display currency |
| `setCurrency(code)` | `(code: string) => void` | sets `NEXT_CURRENCY` for 1 year + updates instantly |
| `rates` | `Record<string, number> \| null` | EUR-based rates from the backend |
| `convertFromEur(amount)` | `(amount: number) => number` | returns the EUR amount when the rate is missing |
| `formatPrice(eurAmount, opts?)` | `(number, { charge?: boolean }) => string` | formats with the active locale (`nl-BE`, `fr-BE`, `en-GB`); `{ charge: true }` always returns EUR |

Server components / non-React code use the pure helpers (pass the rates):

```ts
import { formatPrice, convertFromEur } from "@/lib/currency/convert";

formatPrice(100, { locale: "nl-BE", currency: "USD", rates });     // "$ 108,00"
formatPrice(100, { locale: "nl-BE", currency: "USD", rates, charge: true }); // "€ 100,00"
```

Rates come from `GET <backend>/api/public/exchange-rates` (ECB reference rates,
cached for an hour server-side and refreshed in the background client-side).
Missing rates never produce a wrong number: the EUR amount is formatted instead.

## CMS content

`lib/cms/public.ts` passes the active locale to the public CMS endpoints
(`?locale=en|nl|fr`); the backend falls back to English when a translation is
missing. The locale is part of the fetch URL, i.e. part of Next's cache key.
Revalidation tags stay locale-agnostic so a single admin save flushes all
locales (`app/api/cms/revalidate`).
