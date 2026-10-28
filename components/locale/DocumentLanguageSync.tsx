"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useLocale } from "next-intl";

/**
 * Keep `<html lang>` accurate when the root layout is preserved across
 * client-side navigation. Admin pages are English-only; public pages follow
 * the resolved visitor locale. Server rendering already uses the same rule via
 * the middleware document-locale header.
 */
export default function DocumentLanguageSync() {
  const pathname = usePathname();
  const locale = useLocale();

  useEffect(() => {
    const isAdmin =
      pathname === "/admin" || pathname.startsWith("/admin/");
    document.documentElement.lang = isAdmin ? "en" : locale;
  }, [pathname, locale]);

  return null;
}
