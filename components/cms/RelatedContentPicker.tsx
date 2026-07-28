"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import {
  adminListCms,
  CmsContent,
  CmsContentType,
  CMS_TYPE_LABELS,
  getPublicPathForCms,
} from "@/lib/cms";
import { cn } from "@/lib/utils";

interface RelatedItem {
  _id: string;
  title: string;
  slug: string;
  type: CmsContentType;
}

interface Props {
  value: RelatedItem[];
  onChange: (next: RelatedItem[]) => void;
  excludeId?: string;
  max?: number;
}

const PICKABLE_TYPES: CmsContentType[] = ["blog", "news"];

export default function RelatedContentPicker({ value, onChange, excludeId, max = 8 }: Props) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<RelatedItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all(
      PICKABLE_TYPES.map((type) =>
        adminListCms({
          type,
          status: "published",
          search: debounced || undefined,
          limit: 30,
        }).then((r) => r.items)
      )
    )
      .then((lists) => {
        if (cancelled) return;
        const map = new Map<string, RelatedItem>();
        for (const list of lists) {
          for (const item of list) {
            if (excludeId && item._id === excludeId) continue;
            map.set(item._id, {
              _id: item._id,
              title: item.title,
              slug: item.slug,
              type: item.type,
            });
          }
        }
        setOptions(Array.from(map.values()));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setOptions([]);
        setError(err instanceof Error ? err.message : "Failed to load related content");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debounced, excludeId]);

  const selectedIds = useMemo(() => new Set(value.map((v) => v._id)), [value]);

  const available = useMemo(
    () => options.filter((o) => !selectedIds.has(o._id)),
    [options, selectedIds]
  );

  const add = (item: RelatedItem) => {
    if (selectedIds.has(item._id) || value.length >= max) return;
    onChange([...value, item]);
  };

  const remove = (id: string) => onChange(value.filter((v) => v._id !== id));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {value.length === 0 ? (
          <p className="text-xs text-rose-400">No related articles linked yet.</p>
        ) : (
          value.map((item) => {
            const path = getPublicPathForCms(item.type, item.slug);
            return (
              <span
                key={item._id}
                className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-gradient-to-r from-rose-100 to-pink-100 px-3 py-1 text-xs font-medium text-rose-700"
              >
                <span className="truncate">
                  {CMS_TYPE_LABELS[item.type]} · {item.title}
                </span>
                {path && (
                  <a
                    href={path}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-rose-500 hover:text-rose-800"
                    title="Open public page"
                  >
                    ↗
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => remove(item._id)}
                  className="shrink-0 hover:text-rose-900"
                  aria-label={`Remove ${item.title}`}
                >
                  <X size={12} />
                </button>
              </span>
            );
          })
        )}
      </div>

      <div className="relative">
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-rose-400" />
        <input
          aria-label="Search published blogs and news"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search published blogs & news…"
          className="w-full rounded-xl border border-pink-200 bg-white/60 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-rose-400 focus:bg-white focus:ring-2 focus:ring-rose-200"
        />
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>
      ) : (
        <div className="max-h-44 space-y-1 overflow-y-auto rounded-xl border border-pink-100 bg-rose-50/40 p-2">
          {loading ? (
            <div className="flex items-center gap-2 px-2 py-3 text-xs text-rose-500">
              <Loader2 size={14} className="animate-spin" /> Loading…
            </div>
          ) : available.length === 0 ? (
            <p className="px-2 py-3 text-xs text-rose-400">No matching published articles.</p>
          ) : (
            available.map((item) => (
              <button
                key={item._id}
                type="button"
                disabled={value.length >= max}
                onClick={() => add(item)}
                className={cn(
                  "flex w-full items-start justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition",
                  "hover:bg-white hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-rose-900">{item.title}</span>
                  <span className="text-[11px] text-rose-500">
                    {CMS_TYPE_LABELS[item.type]} · /{item.type}/{item.slug}
                  </span>
                </span>
                <span className="shrink-0 text-xs font-semibold text-rose-600">Add</span>
              </button>
            ))
          )}
        </div>
      )}

      <p className="text-[11px] text-rose-400">
        {value.length}/{max} related articles — shown as “Related reading” on the public page
      </p>
    </div>
  );
}

/** Normalize CMS relatedContent (populated objects or raw ids) into picker items.
 * Raw ids are kept as stubs so a subsequent save cannot wipe links; hydrate with adminGetCms. */
export function relatedItemsFromCms(content?: CmsContent["relatedContent"]): RelatedItem[] {
  if (!Array.isArray(content)) return [];
  const out: RelatedItem[] = [];
  const seen = new Set<string>();
  for (const r of content) {
    if (!r) continue;
    if (typeof r === "string") {
      if (!r || seen.has(r)) continue;
      seen.add(r);
      out.push({ _id: r, title: "Linked article", slug: "", type: "blog" });
      continue;
    }
    if (!r._id || seen.has(r._id)) continue;
    seen.add(r._id);
    if (r.title && r.slug && (r.type === "blog" || r.type === "news")) {
      out.push({ _id: r._id, title: r.title, slug: r.slug, type: r.type });
    } else {
      // Incomplete populate — keep the id so we don't drop the link on save
      out.push({
        _id: r._id,
        title: r.title || "Linked article",
        slug: r.slug || "",
        type: r.type === "news" ? "news" : "blog",
      });
    }
  }
  return out;
}
