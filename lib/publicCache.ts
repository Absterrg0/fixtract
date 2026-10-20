import { getAuthToken } from "@/lib/utils";

/**
 * Public marketing HTML and its data cache. CMS saves purge this on demand.
 * Page files repeat this as a literal (`export const revalidate = 21600`)
 * because Next.js only accepts a numeric literal there.
 */
export const PUBLIC_REVALIDATE_SECONDS = 21600;

export const PUBLIC_CACHE_TAGS = {
  siteSettings: "site-settings",
  serviceCategories: "service-categories",
  popularServices: "popular-services",
  popularProjects: "popular-projects",
} as const;

const ALLOWED_EXACT = new Set<string>(Object.values(PUBLIC_CACHE_TAGS));

export function isPublicCacheTag(tag: string): boolean {
  return ALLOWED_EXACT.has(tag) || tag.startsWith(`${PUBLIC_CACHE_TAGS.popularProjects}:`);
}

export async function revalidatePublicTags(tags: string[]): Promise<void> {
  const unique = [...new Set(tags.filter(isPublicCacheTag))];
  if (unique.length === 0) return;

  const token = getAuthToken();
  const response = await fetch("/api/cms/revalidate", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ tags: unique }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) {
    throw new Error(`Public cache revalidation failed (${response.status})`);
  }
}
