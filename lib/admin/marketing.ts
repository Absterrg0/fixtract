const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "";

export const DEFAULT_LANGUAGES: ReadonlyArray<{ code: string; label: string; countries: string[] }> = [
  { code: "en", label: "English", countries: [] },
  { code: "nl", label: "Nederlands", countries: ["BE", "NL"] },
  { code: "fr", label: "Français", countries: ["BE", "FR"] },
  { code: "de", label: "Deutsch", countries: ["DE"] },
];

export interface LanguageOption { code: string; label: string; countries: string[] }
export interface ServiceOption { key: string; label: string; countries?: string[] }

export function errMessage(error: unknown, fallback: string) { return error instanceof Error && error.message ? error.message : fallback; }
export function requireApiBase() { if (!API_BASE) throw new Error("NEXT_PUBLIC_BACKEND_URL is not configured"); return API_BASE; }
export function formatDate(value?: string | null) { return value ? new Date(value).toLocaleString() : "—"; }

export function normalizeLanguages(value: unknown): LanguageOption[] { const source = Array.isArray(value) ? value : []; const normalized = source.map((item) => { if (typeof item === "string") return { code: item, label: item.toUpperCase(), countries: [] as string[] }; if (!item || typeof item !== "object") return null; const record = item as Record<string, unknown>; const code = String(record.code || record.locale || record.key || "").toLowerCase(); return code ? { code, label: String(record.label || record.name || code.toUpperCase()), countries: Array.isArray(record.countries) ? record.countries.map(String) : [] } : null; }).filter((item): item is LanguageOption => Boolean(item)); const merged = new Map<string, LanguageOption>(DEFAULT_LANGUAGES.map((item) => [item.code, { code: item.code, label: item.label, countries: [...item.countries] }])); normalized.forEach((item) => merged.set(item.code, item)); return Array.from(merged.values()); }
export function normalizeServices(value: unknown): ServiceOption[] { const source = Array.isArray(value) ? value : []; return source.map((item) => { if (typeof item === "string") return { key: item, label: item }; if (!item || typeof item !== "object") return null; const record = item as Record<string, unknown>; const key = String(record.key || record.serviceKey || record.value || ""); return key ? { key, label: String(record.label || record.name || key), countries: Array.isArray(record.countries) ? record.countries.map(String) : undefined } : null; }).filter((item): item is ServiceOption => Boolean(item)); }
