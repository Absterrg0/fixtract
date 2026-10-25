"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { getErrorMessage } from "@/lib/apiErrors";

/**
 * Localized error text for public pages. Keeps safe server validation copy and
 * replaces transport/HTTP/server internals with a translated fallback.
 *
 * Admin pages stay English and must use `getErrorMessage` directly.
 */
export function useErrorMessage() {
  const t = useTranslations("common.errors");

  return useCallback(
    (error: unknown, fallback?: string) =>
      getErrorMessage(error, fallback ?? t("generic"), {
        network: t("network"),
        timeout: t("timeout"),
        canceled: t("canceled"),
        auth: t("auth"),
        signInRequired: t("signInRequired"),
        forbidden: t("forbidden"),
        notFound: t("notFound"),
        validation: t("validation"),
        conflict: t("conflict"),
        rateLimited: t("rateLimited"),
        payloadTooLarge: t("payloadTooLarge"),
        server: t("server"),
        unavailable: t("unavailable"),
        invalidResponse: t("invalidResponse"),
        unknown: t("generic"),
      }),
    [t],
  );
}
