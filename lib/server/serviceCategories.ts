import "server-only";

import { PUBLIC_CACHE_TAGS, PUBLIC_REVALIDATE_SECONDS } from "@/lib/publicCache";

export interface ServiceCategoryItem {
  name: string;
  slug: string;
  icon?: string;
  /**
   * True only for the app's static outage fallback. The subnav translates
   * these known labels; names returned by the API stay untouched.
   */
  isFallback?: boolean;
  services: Array<{
    name: string;
    slug: string;
    icon?: string;
  }>;
}

const SERVICE_CATEGORY_TIMEOUT_MS = 3_000;

const FALLBACK_SERVICE_CATEGORIES: ServiceCategoryItem[] = [
  { name: "Small tasks", slug: "small-tasks", services: [], isFallback: true },
  { name: "Interior", slug: "interior", services: [], isFallback: true },
  { name: "Exterior", slug: "exterior", services: [], isFallback: true },
  { name: "Outdoor work", slug: "outdoor-work", services: [], isFallback: true },
  { name: "Renovation", slug: "renovation", services: [], isFallback: true },
  { name: "Inspections", slug: "inspections", services: [], isFallback: true },
];

const isNonBlankString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isServiceItem = (
  value: unknown,
): value is ServiceCategoryItem["services"][number] =>
  typeof value === "object" &&
  value !== null &&
  isNonBlankString((value as { name?: unknown }).name) &&
  isNonBlankString((value as { slug?: unknown }).slug) &&
  ((value as { icon?: unknown }).icon === undefined ||
    typeof (value as { icon?: unknown }).icon === "string");

const isServiceCategoryItem = (value: unknown): value is ServiceCategoryItem =>
  typeof value === "object" &&
  value !== null &&
  isNonBlankString((value as { name?: unknown }).name) &&
  isNonBlankString((value as { slug?: unknown }).slug) &&
  ((value as { icon?: unknown }).icon === undefined ||
    typeof (value as { icon?: unknown }).icon === "string") &&
  Array.isArray((value as { services?: unknown }).services) &&
  (value as { services: unknown[] }).services.every(isServiceItem);

export async function getServiceCategories(
  country = "BE",
): Promise<ServiceCategoryItem[]> {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (!backendUrl) return FALLBACK_SERVICE_CATEGORIES;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SERVICE_CATEGORY_TIMEOUT_MS);
    try {
      const response = await fetch(
        `${backendUrl}/api/service-categories/active?country=${encodeURIComponent(country)}`,
        {
          next: { revalidate: PUBLIC_REVALIDATE_SECONDS, tags: [PUBLIC_CACHE_TAGS.serviceCategories] },
          signal: controller.signal,
        },
      );
      if (!response.ok) throw new Error(`Service categories request failed (${response.status})`);
      const categories: unknown = await response.json();
      return Array.isArray(categories) &&
        categories.length > 0 &&
        categories.every(isServiceCategoryItem)
        ? categories
        : FALLBACK_SERVICE_CATEGORIES;
    } finally {
      clearTimeout(timeoutId);
    }
  } catch {
    return FALLBACK_SERVICE_CATEGORIES;
  }
}
