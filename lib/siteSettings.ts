import { authFetch } from "@/lib/utils";
import { apiErrorFromBody } from "@/lib/apiErrors";
import { PUBLIC_CACHE_TAGS, PUBLIC_REVALIDATE_SECONDS, revalidatePublicTags } from "@/lib/publicCache";

export interface SocialLinks {
  facebook?: string;
  twitter?: string;
  instagram?: string;
  linkedin?: string;
  tiktok?: string;
  youtube?: string;
}

export interface SiteSettings {
  socialLinks?: SocialLinks;
}

const API = process.env.NEXT_PUBLIC_BACKEND_URL || "";
const DEFAULT_SETTINGS: SiteSettings = { socialLinks: {} };

interface ApiEnvelope {
  success?: boolean;
  msg?: string;
  data?: unknown;
}

async function safeParseJson(res: Response): Promise<{ body: ApiEnvelope | null; text?: string }> {
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const text = await res.text().catch(() => "");
    return { body: null, text };
  }
  try {
    const body = (await res.json()) as ApiEnvelope;
    return { body };
  } catch {
    return { body: null };
  }
}

export async function publicGetSiteSettings(): Promise<SiteSettings> {
  try {
    const res = await fetch(`${API}/api/public/site-settings`, {
      next: { revalidate: PUBLIC_REVALIDATE_SECONDS, tags: [PUBLIC_CACHE_TAGS.siteSettings] },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return DEFAULT_SETTINGS;
    const { body } = await safeParseJson(res);
    if (!body || body?.success === false) return DEFAULT_SETTINGS;
    return (body?.data as SiteSettings) || DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function adminGetSiteSettings(): Promise<SiteSettings> {
  const res = await authFetch(`${API}/api/admin/site-settings`);
  const { body } = await safeParseJson(res);
  if (!res.ok || !body || body?.success === false || body.data == null) {
    throw apiErrorFromBody(body, 'Could not load site settings', { status: res.status });
  }
  return body.data as SiteSettings;
}

export async function adminUpdateSiteSettings(payload: { socialLinks?: SocialLinks }): Promise<SiteSettings> {
  const res = await authFetch(`${API}/api/admin/site-settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const { body } = await safeParseJson(res);
  if (!res.ok || !body || body?.success === false || body.data == null) {
    throw apiErrorFromBody(body, 'Could not save site settings', { status: res.status });
  }
  try {
    await revalidatePublicTags([PUBLIC_CACHE_TAGS.siteSettings]);
  } catch (error) {
    console.error("Site settings cache revalidation failed:", error);
  }
  return body.data as SiteSettings;
}
