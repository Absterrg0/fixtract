import common from "../messages/en/common.json";
import nav from "../messages/en/nav.json";
import footer from "../messages/en/footer.json";
import cookieConsent from "../messages/en/cookieConsent.json";
import localeSwitcher from "../messages/en/localeSwitcher.json";

/**
 * Type-safety for next-intl: message trees are typed from the English files,
 * so a missing or misspelled translation key fails `tsc` for all locales.
 */
declare module "next-intl" {
  interface AppConfig {
    Locale: "en" | "nl" | "fr";
    Messages: {
      common: typeof common;
      nav: typeof nav;
      footer: typeof footer;
      cookieConsent: typeof cookieConsent;
      localeSwitcher: typeof localeSwitcher;
    };
  }
}
