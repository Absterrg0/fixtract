import "server-only";

import { headers } from "next/headers";
import { CURRENCY_REQUEST_HEADER } from "@/i18n/config";
import { DEFAULT_CURRENCY, type CurrencyCode } from "@/lib/currency/currencies";
import { sanitizeCurrency } from "@/lib/currency/rates";

/**
 * Active display currency for this request. Middleware forwards the resolved
 * currency on `x-fixera-currency` (cookie fallbacks are handled there).
 */
export async function getActiveCurrency(): Promise<CurrencyCode> {
  const value = (await headers()).get(CURRENCY_REQUEST_HEADER);
  return sanitizeCurrency(value) ?? DEFAULT_CURRENCY;
}
