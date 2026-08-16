import "server-only";

import { cache } from "react";
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
    if (!response.ok) {
      console.error("popular fetch returned non-ok", { path, cacheTag, status: response.status });
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error("popular fetch failed", { path, cacheTag, error });
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

const isNonBlankString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const optionalString = (value: unknown): string | null =>
  typeof value === "string" ? value : null;

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
  const professional = value.professional as Record<string, unknown> | null;
  return {
    _id: value._id,
    title: value.title,
    category: value.category,
    service: value.service,
    image: optionalString(value.image),
    location: optionalString(value.location),
    startingPrice: typeof value.startingPrice === "number" ? value.startingPrice : null,
    priceType: typeof value.priceType === "string" ? value.priceType : "rfq",
    avgRating: typeof value.avgRating === "number" ? value.avgRating : 0,
    totalReviews: typeof value.totalReviews === "number" ? value.totalReviews : 0,
    professional:
      professional && typeof professional === "object"
        ? {
            name: isNonBlankString(professional.name) ? professional.name : "Unknown",
            profileImage: optionalString(professional.profileImage),
            city: optionalString(professional.city),
            country: optionalString(professional.country),
          }
        : null,
  };
}

export const getPopularServices = cache(async function getPopularServices(limit = 5): Promise<string[]> {
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
});

const getPopularProjectsCached = cache(async function getPopularProjectsCached(
  limit: number,
  service: string,
): Promise<PopularProject[]> {
  const params = new URLSearchParams({ limit: String(limit) });
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
});

export async function getPopularProjects(options?: {
  limit?: number;
  service?: string;
}): Promise<PopularProject[]> {
  const limit = Math.min(Math.max(options?.limit ?? 10, 1), 20);
  const service = options?.service?.trim() ?? "";
  return getPopularProjectsCached(limit, service);
}
