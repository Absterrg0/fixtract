import "server-only";

import type { PopularProject } from "@/lib/popularProject";

const POPULAR_TIMEOUT_MS = 4_000;

function backendUrl(): string | null {
  return process.env.NEXT_PUBLIC_BACKEND_URL || null;
}

async function fetchJson(
  path: string,
  cacheTag: string,
): Promise<unknown | null> {
  const base = backendUrl();
  if (!base) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), POPULAR_TIMEOUT_MS);
  try {
    const response = await fetch(`${base}${path}`, {
      next: { revalidate: 60, tags: [cacheTag] },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

const isNonBlankString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

function isPopularProject(value: unknown): value is PopularProject {
  if (typeof value !== "object" || value === null) return false;
  const project = value as Record<string, unknown>;
  return (
    isNonBlankString(project._id) &&
    isNonBlankString(project.title) &&
    isNonBlankString(project.category) &&
    isNonBlankString(project.service)
  );
}

function toPopularProject(value: unknown): PopularProject | null {
  if (!isPopularProject(value)) return null;
  const professional = value.professional;
  return {
    _id: value._id,
    title: value.title,
    category: value.category,
    service: value.service,
    image: typeof value.image === "string" ? value.image : null,
    location: typeof value.location === "string" ? value.location : null,
    startingPrice: typeof value.startingPrice === "number" ? value.startingPrice : null,
    priceType: typeof value.priceType === "string" ? value.priceType : "rfq",
    avgRating: typeof value.avgRating === "number" ? value.avgRating : 0,
    totalReviews: typeof value.totalReviews === "number" ? value.totalReviews : 0,
    professional:
      professional && typeof professional === "object"
        ? {
            name: isNonBlankString((professional as { name?: unknown }).name)
              ? (professional as { name: string }).name
              : "Unknown",
            profileImage:
              typeof (professional as { profileImage?: unknown }).profileImage === "string"
                ? (professional as { profileImage: string }).profileImage
                : null,
            city:
              typeof (professional as { city?: unknown }).city === "string"
                ? (professional as { city: string }).city
                : null,
            country:
              typeof (professional as { country?: unknown }).country === "string"
                ? (professional as { country: string }).country
                : null,
          }
        : null,
  };
}

export async function getPopularServices(limit = 5): Promise<string[]> {
  const capped = Math.min(Math.max(limit, 1), 50);
  const data = await fetchJson(
    `/api/search/popular?limit=${capped}`,
    "popular-services",
  );
  if (!data || typeof data !== "object") return [];
  const services = (data as { services?: unknown }).services;
  if (!Array.isArray(services)) return [];
  return services
    .map((item) =>
      typeof item === "object" && item !== null
        ? (item as { name?: unknown }).name
        : null,
    )
    .filter(isNonBlankString)
    .slice(0, capped);
}

export async function getPopularProjects(options?: {
  limit?: number;
  service?: string;
}): Promise<PopularProject[]> {
  const limit = Math.min(Math.max(options?.limit ?? 10, 1), 20);
  const params = new URLSearchParams({ limit: String(limit) });
  const service = options?.service?.trim();
  if (service) params.set("service", service);

  const data = await fetchJson(
    `/api/search/popular-projects?${params.toString()}`,
    service ? `popular-projects:${service}` : "popular-projects",
  );
  if (!data || typeof data !== "object") return [];
  const projects = (data as { projects?: unknown }).projects;
  if (!Array.isArray(projects)) return [];
  return projects.flatMap((item) => {
    const project = toPopularProject(item);
    return project ? [project] : [];
  });
}
