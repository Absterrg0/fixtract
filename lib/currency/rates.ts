import "server-only";

import type { ExchangeRateData } from "@/lib/currency/convert";
import {
  type CurrencyCode,
  isSupportedCurrency,
} from "@/lib/currency/currencies";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "";
const RATES_REVALIDATE_SECONDS = 60 * 60;

interface ExchangeRatesEnvelope {
  success?: boolean;
  data?: {
    base?: unknown;
    date?: unknown;
    rates?: unknown;
  };
}

function toRateData(payload: ExchangeRatesEnvelope): ExchangeRateData | null {
  const raw = payload?.data;
  if (!raw || typeof raw !== "object") return null;
  const rates = raw.rates;
  if (!rates || typeof rates !== "object") return null;

  const normalized: Record<string, number> = {};
  for (const [code, value] of Object.entries(rates as Record<string, unknown>)) {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      normalized[code.toUpperCase()] = value;
    }
  }
  if (Object.keys(normalized).length === 0) return null;
  normalized.EUR = 1;

  const date = typeof raw.date === "string" && raw.date ? raw.date : "";

  return { base: "EUR", date, rates: normalized };
}

/**
 * Server fetch of the backend endpoint:
 * GET /api/public/exchange-rates → { success, data: { base, date, rates } }
 * Cached for one hour; returns null when the backend is unavailable.
 */
export async function getExchangeRates(): Promise<ExchangeRateData | null> {
  if (!BACKEND_URL) return null;
  try {
    const res = await fetch(`${BACKEND_URL}/api/public/exchange-rates`, {
      next: { revalidate: RATES_REVALIDATE_SECONDS, tags: ["exchange-rates"] },
      signal: AbortSignal.timeout(2_000),
    });
    if (!res.ok) return null;
    return toRateData((await res.json()) as ExchangeRatesEnvelope);
  } catch {
    return null;
  }
}

/** Validate a raw currency code (cookie/param/header) against the support list. */
export function sanitizeCurrency(
  value: string | null | undefined
): CurrencyCode | null {
  return isSupportedCurrency(value) ? value : null;
}
