import "server-only";

export interface ServiceCategoryItem {
  name: string;
  slug: string;
  icon?: string;
  services: Array<{
    name: string;
    slug: string;
    icon?: string;
  }>;
}

const FALLBACK_SERVICE_CATEGORIES: ServiceCategoryItem[] = [
  { name: "Small tasks", slug: "small-tasks", services: [] },
  { name: "Interior", slug: "interior", services: [] },
  { name: "Exterior", slug: "exterior", services: [] },
  { name: "Outdoor work", slug: "outdoor-work", services: [] },
  { name: "Renovation", slug: "renovation", services: [] },
  { name: "Inspections", slug: "inspections", services: [] },
];

export async function getServiceCategories(
  country = "BE",
): Promise<ServiceCategoryItem[]> {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (!backendUrl) return FALLBACK_SERVICE_CATEGORIES;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8_000);
    try {
      const response = await fetch(
        `${backendUrl}/api/service-categories/active?country=${encodeURIComponent(country)}`,
        { next: { revalidate: 300 }, signal: controller.signal },
      );
      if (!response.ok) throw new Error(`Service categories request failed (${response.status})`);
      const categories = (await response.json()) as ServiceCategoryItem[];
      return categories.length > 0 ? categories : FALLBACK_SERVICE_CATEGORIES;
    } finally {
      clearTimeout(timeoutId);
    }
  } catch {
    return FALLBACK_SERVICE_CATEGORIES;
  }
}
