import { BASE_CURRENCY } from "@/lib/currency/currencies";

/**
 * Server/client-safe pure conversion + formatting helpers. Receives the rates
 * explicitly, so it can be used from server components.
 */

export interface ExchangeRateData {
  base: "EUR";
  date: string;
  rates: Record<string, number>;
}

/** Convert an EUR amount into the target currency using stored euro-based rates. */
export function convertFromEur(
  amount: number,
  currency: string,
  rates: Record<string, number> | null | undefined
): number {
  if (currency === BASE_CURRENCY) return amount;
  const rate = rates?.[currency];
  if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
    return amount; // never guess — callers fall back to EUR display
  }
  return amount * rate;
}

export interface PriceOptions {
  /** Active next-intl locale or any valid Intl tag. */
  locale: string;
  /** Display currency code. */
  currency: string;
  /** Euro-based rates; falls back to EUR display when missing. */
  rates?: Record<string, number> | null;
  /** Checkout/payment/invoice contexts: always the charged (EUR) amount. */
  charge?: boolean;
}

function formatAmount(amount: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
  }).format(amount);
}

/**
 * Format a EUR amount for display in the given currency. When the target
 * currency has no available rate (or `charge` is set), the EUR amount is
 * formatted as-is — a wrong number is never shown.
 */
export function formatPrice(amount: number, options: PriceOptions): string {
  const { locale, currency, rates } = options;
  if (options.charge || currency === BASE_CURRENCY) {
    return formatAmount(amount, BASE_CURRENCY, locale);
  }
  const rate = rates?.[currency];
  if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
    return formatAmount(amount, BASE_CURRENCY, locale);
  }
  const converted = convertFromEur(amount, currency, rates);
  return formatAmount(converted, currency, locale);
}
