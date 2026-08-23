import { headers } from "next/headers";
import { sanitizeRichText } from "@/lib/cms/sanitize";
import type {
  CmsContent,
  CmsContentType,
  CmsListResponse,
  FaqCategory,
  FaqGroup,
} from "@/lib/cms";
import { getVisitorCountryCode, parseVisitorCountryCode } from "@/lib/cms/visitorCountry";

const API = process.env.NEXT_PUBLIC_BACKEND_URL || "";

async function parseJsonRequired<T>(res: Response): Promise<T> {
  if (res.status === 204) {
    throw new Error(`Request returned no body (${res.status}) but a response was expected`);
  }
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const text = await res.text().catch(() => "");
    throw new Error(
      text
        ? `Request failed (${res.status}): ${text.slice(0, 200)}`
        : `Request failed (${res.status})`
    );
  }
  const data = await res.json();
  if (!res.ok || data?.success === false) {
    throw new Error(data?.msg || `Request failed (${res.status})`);
  }
  return (data?.data ?? data) as T;
}

async function getTrustedRequestCountry(): Promise<string | undefined> {
  const requestCountry = parseVisitorCountryCode((await headers()).get("x-vercel-ip-country"));
  if (requestCountry) return requestCountry;
  // Local development has no platform geo header; retain the middleware's dev override.
  return process.env.NODE_ENV === "production" ? undefined : getVisitorCountryCode();
}

async function cmsFetchHeaders(): Promise<HeadersInit | undefined> {
  const country = await getTrustedRequestCountry();
  return country ? { "x-vercel-ip-country": country } : undefined;
}

export async function publicListCms(
  type: CmsContentType,
  params: { page?: number; limit?: number; tag?: string; serviceSlug?: string } = {}
): Promise<CmsListResponse> {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.tag) qs.set("tag", params.tag);
  if (params.serviceSlug) qs.set("serviceSlug", params.serviceSlug);
  const res = await fetch(`${API}/api/public/cms/${type}?${qs.toString()}`, {
    headers: await cmsFetchHeaders(),
    next: { revalidate: 60, tags: ["cms", `cms:${type}`] },
  });
  const data = await parseJsonRequired<CmsListResponse>(res);
  data.items = data.items.map((item) => ({ ...item, body: sanitizeRichText(item.body || "") }));
  return data;
}

export async function publicGetCms(
  type: CmsContentType,
  slug: string,
): Promise<CmsContent | null> {
  const res = await fetch(
    `${API}/api/public/cms/${type}/${encodeURIComponent(slug)}`,
    {
      headers: await cmsFetchHeaders(),
      next: { revalidate: 60, tags: ["cms", `cms:${type}`, `cms:${type}:${slug}`] },
    },
  );
  if (res.status === 404) return null;
  const data = await parseJsonRequired<CmsContent>(res);
  return { ...data, body: sanitizeRichText(data.body || "") };
}

export async function fetchCmsPostWithError(
  type: CmsContentType,
  slug: string,
): Promise<{ post: CmsContent | null; fetchError: boolean }> {
  try {
    const post = await publicGetCms(type, slug);
    return { post, fetchError: false };
  } catch {
    return { post: null, fetchError: true };
  }
}

export async function publicGetFaq(): Promise<{ groups: FaqGroup[]; categories: FaqCategory[] }> {
  const res = await fetch(`${API}/api/public/cms/faq`, {
    headers: await cmsFetchHeaders(),
    next: { revalidate: 60, tags: ["cms", "cms:faq"] },
  });
  const data = await parseJsonRequired<{ groups: FaqGroup[]; categories: FaqCategory[] }>(res);
  data.groups = data.groups.map((g) => ({
    ...g,
    items: g.items.map((it) => ({ ...it, body: sanitizeRichText(it.body || "") })),
  }));
  return data;
}
