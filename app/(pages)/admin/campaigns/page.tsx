"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { authFetch } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Pencil,
  Trash2,
  Send,
  RefreshCw,
  Users,
  Loader2,
  Mail,
  BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import { useAdminAccess } from "@/hooks/useAdminAccess";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "";
const LOCALES = ["en", "nl", "fr"] as const;
type Locale = (typeof LOCALES)[number];
type CampaignType = "newsletter" | "promotion" | "reengagement";

function errMessage(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback;
}

function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toScheduledIso(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function requireApiBase(): string {
  if (!API_BASE) {
    throw new Error("NEXT_PUBLIC_BACKEND_URL is not configured");
  }
  return API_BASE;
}

interface LocaleContent {
  subject: string;
  htmlContent: string;
  previewText?: string;
  brevoTemplateId?: number;
}

interface BrevoTemplate {
  id: number;
  name: string;
  subject: string;
  tag: string;
  modifiedAt: string;
}

interface Campaign {
  _id: string;
  name: string;
  type: CampaignType;
  status: string;
  content: Partial<Record<Locale, LocaleContent>>;
  audience: {
    countries: string[];
    interestedServices: string[];
    locales: Locale[];
    roles: Array<"customer" | "professional">;
  };
  inactiveDays?: number;
  autoSend: boolean;
  scheduledAt?: string | null;
  sentAt?: string | null;
  deliveries: Array<{
    locale: Locale;
    recipientCount: number;
    brevoCampaignId?: number;
    stats?: {
      sent: number;
      delivered: number;
      uniqueViews: number;
      uniqueClicks: number;
      unsubscriptions: number;
    };
    error?: string;
  }>;
  lastError?: string;
  utmCampaign?: string;
  updatedAt: string;
}

interface FormState {
  name: string;
  type: CampaignType;
  countries: string;
  interestedServices: string;
  locales: Locale[];
  roles: Array<"customer" | "professional">;
  inactiveDays: string;
  autoSend: boolean;
  scheduledAt: string;
  utmCampaign: string;
  content: Record<Locale, LocaleContent>;
}

const emptyContent = (): LocaleContent => ({
  subject: "",
  htmlContent: "",
  previewText: "",
});

const emptyForm = (): FormState => ({
  name: "",
  type: "newsletter",
  countries: "",
  interestedServices: "",
  locales: ["en"],
  roles: ["customer", "professional"],
  inactiveDays: "60",
  autoSend: false,
  scheduledAt: "",
  utmCampaign: "",
  content: {
    en: emptyContent(),
    nl: emptyContent(),
    fr: emptyContent(),
  },
});

const statusColor = (status: string) => {
  switch (status) {
    case "sent":
      return "bg-emerald-100 text-emerald-800";
    case "scheduled":
      return "bg-blue-100 text-blue-800";
    case "failed":
      return "bg-rose-100 text-rose-800";
    case "sending":
      return "bg-amber-100 text-amber-800";
    default:
      return "bg-slate-100 text-slate-700";
  }
};

export default function AdminCampaignsPage() {
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { canAccessPath } = useAdminAccess();
  const canManage = canAccessPath("/admin/campaigns");
  const isAdmin = Boolean(isAuthenticated && user?.role === "admin");
  const showPage = !authLoading && isAdmin && canManage;

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [activeLocaleTab, setActiveLocaleTab] = useState<Locale>("en");
  const [audiencePreview, setAudiencePreview] = useState<{
    count: number;
    truncated: boolean;
  } | null>(null);
  const [audienceLoading, setAudienceLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [templates, setTemplates] = useState<BrevoTemplate[] | null>(null);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [actionIds, setActionIds] = useState<Set<string>>(() => new Set());
  const latestLoadId = useRef(0);
  const latestPreviewId = useRef(0);
  const previewAudienceKey = useRef("");

  useEffect(() => {
    if (authLoading) return;
    if (!isAdmin) {
      router.replace("/login");
      return;
    }
    if (!canManage) router.replace("/dashboard");
  }, [authLoading, isAdmin, canManage, router]);

  const beginAction = (id: string) => {
    setActionIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const endAction = (id: string) => {
    setActionIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const load = useCallback(async () => {
    const loadId = ++latestLoadId.current;
    setLoading(true);
    try {
      const res = await authFetch(
        `${requireApiBase()}/api/admin/marketing-campaigns?page=${page}&limit=25`,
      );
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.msg || "Failed to load");
      if (loadId === latestLoadId.current) {
        const nextTotalPages = Math.max(1, Number(json.data.pagination?.totalPages) || 1);
        setTotalPages(nextTotalPages);
        if (page > nextTotalPages) {
          setPage(nextTotalPages);
          return;
        }
        setCampaigns(json.data.campaigns || []);
      }
    } catch (e: unknown) {
      if (loadId === latestLoadId.current) {
        toast.error(errMessage(e, "Failed to load campaigns"));
      }
    } finally {
      if (loadId === latestLoadId.current) {
        setLoading(false);
      }
    }
  }, [page]);

  useEffect(() => {
    if (showPage) load();
  }, [showPage, load]);

  useEffect(() => {
    if (!dialogOpen || templates !== null) return;
    const controller = new AbortController();
    setTemplatesLoading(true);
    let base: string;
    try {
      base = requireApiBase();
    } catch (error) {
      setTemplates([]);
      setTemplatesLoading(false);
      toast.error(errMessage(error, "Failed to load Brevo templates"));
      return;
    }
    authFetch(`${base}/api/admin/marketing-campaigns/templates`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.success) throw new Error(json?.msg || "Template lookup failed");
        if (!controller.signal.aborted) setTemplates(json.data?.templates || []);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setTemplates([]);
        toast.error(errMessage(error, "Failed to load Brevo templates"));
      })
      .finally(() => {
        if (!controller.signal.aborted) setTemplatesLoading(false);
      });
    return () => {
      controller.abort();
    };
  }, [dialogOpen, templates]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setAudiencePreview(null);
    setActiveLocaleTab("en");
    setDialogOpen(true);
  };

  const openEdit = (c: Campaign) => {
    setEditingId(c._id);
    setForm({
      name: c.name,
      type: c.type,
      countries: (c.audience?.countries || []).join(", "),
      interestedServices: (c.audience?.interestedServices || []).join(", "),
      locales: (c.audience?.locales?.length ? c.audience.locales : LOCALES.filter((l) => c.content?.[l])) as Locale[],
      roles: c.audience?.roles?.length ? c.audience.roles : ["customer", "professional"],
      inactiveDays: String(c.inactiveDays || 60),
      autoSend: Boolean(c.autoSend),
      scheduledAt: c.scheduledAt ? toDatetimeLocalValue(c.scheduledAt) : "",
      utmCampaign: c.utmCampaign || "",
      content: {
        en: c.content?.en || emptyContent(),
        nl: c.content?.nl || emptyContent(),
        fr: c.content?.fr || emptyContent(),
      },
    });
    setAudiencePreview(null);
    setActiveLocaleTab("en");
    setDialogOpen(true);
  };

  const payload = useMemo(() => {
    const content: Partial<Record<Locale, LocaleContent>> = {};
    for (const locale of LOCALES) {
      const block = form.content[locale];
      if (block.subject.trim() && (block.htmlContent.trim() || block.brevoTemplateId)) {
        content[locale] = {
          subject: block.subject.trim(),
          htmlContent: block.htmlContent,
          previewText: block.previewText?.trim() || undefined,
          brevoTemplateId: block.brevoTemplateId || undefined,
        };
      }
    }
    return {
      name: form.name.trim(),
      type: form.type,
      audience: {
        countries: form.countries
          .split(",")
          .map((c) => c.trim().toUpperCase())
          .filter(Boolean),
        interestedServices: form.interestedServices
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        locales: form.locales,
        roles: form.roles,
      },
      content,
      inactiveDays: form.type === "reengagement" ? Number(form.inactiveDays) || 60 : undefined,
      autoSend: form.type === "reengagement" ? form.autoSend : false,
      scheduledAt: toScheduledIso(form.scheduledAt),
      utmCampaign: form.utmCampaign.trim() || undefined,
    };
  }, [form]);

  const audienceKey = useMemo(
    () => JSON.stringify([payload.audience, payload.inactiveDays]),
    [payload.audience, payload.inactiveDays],
  );

  useEffect(() => {
    previewAudienceKey.current = audienceKey;
    latestPreviewId.current += 1;
    setAudiencePreview(null);
    setAudienceLoading(false);
  }, [audienceKey]);

  const previewAudience = async () => {
    if (form.locales.length === 0 || form.roles.length === 0) {
      toast.error("Select at least one audience locale and role");
      return;
    }
    const missingLocaleContent = form.locales.filter((locale) => !payload.content[locale]);
    if (missingLocaleContent.length > 0) {
      toast.error(`Provide content for every selected locale: ${missingLocaleContent.join(", ")}`);
      return;
    }
    const requestId = ++latestPreviewId.current;
    const requestKey = audienceKey;
    setAudienceLoading(true);
    try {
      const res = await authFetch(`${requireApiBase()}/api/admin/marketing-campaigns/preview-audience`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audience: payload.audience,
          inactiveDays: payload.inactiveDays,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.msg || "Preview failed");
      const nextPreview = {
        count: Number(json.data.count) || 0,
        truncated: Boolean(json.data.truncated),
      };
      if (
        requestId !== latestPreviewId.current ||
        requestKey !== previewAudienceKey.current
      ) {
        return;
      }
      setAudiencePreview(nextPreview);
      if (nextPreview.truncated) {
        toast.error("Audience exceeds the 5,000-recipient delivery limit");
      }
    } catch (e: unknown) {
      if (requestId === latestPreviewId.current) {
        toast.error(errMessage(e, "Audience preview failed"));
      }
    } finally {
      if (requestId === latestPreviewId.current) {
        setAudienceLoading(false);
      }
    }
  };

  const handleSave = async () => {
    if (!payload.name || Object.keys(payload.content).length === 0) {
      toast.error("Name and at least one locale with subject and content are required");
      return;
    }
    if (form.locales.length === 0 || form.roles.length === 0) {
      toast.error("Select at least one audience locale and role");
      return;
    }
    if (form.scheduledAt && !payload.scheduledAt) {
      toast.error("Enter a valid schedule date and time");
      return;
    }
    setSaving(true);
    try {
      const base = requireApiBase();
      const url = editingId
        ? `${base}/api/admin/marketing-campaigns/${editingId}`
        : `${base}/api/admin/marketing-campaigns`;
      const res = await authFetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.msg || "Save failed");
      toast.success(editingId ? "Campaign updated" : "Campaign created");
      setDialogOpen(false);
      await load();
    } catch (e: unknown) {
      toast.error(errMessage(e, "Save failed"));
    } finally {
      setSaving(false);
    }
  };

  const handleSend = async (id: string) => {
    if (!confirm("Send this campaign now via Brevo to the matched audience?")) return;
    beginAction(id);
    try {
      const res = await authFetch(`${requireApiBase()}/api/admin/marketing-campaigns/${id}/send`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.msg || "Send failed");
      toast.success("Campaign sent");
      await load();
    } catch (e: unknown) {
      toast.error(errMessage(e, "Send failed"));
    } finally {
      endAction(id);
    }
  };

  const handleStats = async (id: string) => {
    beginAction(id);
    try {
      const res = await authFetch(`${requireApiBase()}/api/admin/marketing-campaigns/${id}/stats`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.msg || "Refresh failed");
      toast.success("Stats refreshed from Brevo");
      await load();
    } catch (e: unknown) {
      toast.error(errMessage(e, "Refresh failed"));
    } finally {
      endAction(id);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this campaign?")) return;
    beginAction(id);
    try {
      const res = await authFetch(`${requireApiBase()}/api/admin/marketing-campaigns/${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.msg || "Delete failed");
      toast.success("Deleted");
      if (campaigns.length === 1 && page > 1) {
        setPage((current) => current - 1);
      } else {
        await load();
      }
    } catch (e: unknown) {
      toast.error(errMessage(e, "Delete failed"));
    } finally {
      endAction(id);
    }
  };

  const syncSubscribers = async () => {
    setSyncing(true);
    try {
      const res = await authFetch(`${requireApiBase()}/api/admin/marketing-subscribers/sync`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.msg || "Sync failed");
      toast.success(
        `Synced subscribers (upserted ${json.data.upserted}, unsubscribed ${json.data.unsubscribed})`,
      );
    } catch (e: unknown) {
      toast.error(errMessage(e, "Sync failed"));
    } finally {
      setSyncing(false);
    }
  };

  if (authLoading || !showPage) {
    return (
      <div className="p-8">
        <Skeleton className="h-10 w-64 mb-4" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Email campaigns</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Multilingual newsletters, promotions, and re-engagement via Brevo — filtered by region
            and interested service.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={syncSubscribers} disabled={syncing}>
            {syncing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Users className="h-4 w-4 mr-2" />}
            Sync subscribers
          </Button>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            New campaign
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : campaigns.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No campaigns yet</CardTitle>
            <CardDescription>
              Create a draft, sync subscribers from opted-in users, preview the audience, then send
              through Brevo.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="space-y-3">
            {campaigns.map((c) => {
            const hasStartedDelivery = (c.deliveries || []).some((delivery) =>
              Boolean(delivery.brevoCampaignId),
            );
            const canMutate = ["draft", "scheduled", "failed"].includes(c.status) && !hasStartedDelivery;
            const totals = (c.deliveries || []).reduce(
              (acc, d) => {
                acc.recipients += d.recipientCount || 0;
                acc.sent += d.stats?.sent || 0;
                acc.opens += d.stats?.uniqueViews || 0;
                acc.clicks += d.stats?.uniqueClicks || 0;
                return acc;
              },
              { recipients: 0, sent: 0, opens: 0, clicks: 0 },
            );
            return (
              <Card key={c._id}>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Mail className="h-4 w-4" />
                        {c.name}
                      </CardTitle>
                      <CardDescription className="mt-1 flex flex-wrap gap-2 items-center">
                        <Badge variant="outline">{c.type}</Badge>
                        <span className={`rounded-full px-2 py-0.5 text-xs ${statusColor(c.status)}`}>
                          {c.status}
                        </span>
                        {c.autoSend && <Badge variant="secondary">auto re-engagement</Badge>}
                        {c.lastError && <span className="text-rose-600">{c.lastError}</span>}
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {canMutate && (
                        <Button size="sm" variant="outline" onClick={() => openEdit(c)}>
                          <Pencil className="h-3.5 w-3.5 mr-1" />
                          Edit
                        </Button>
                      )}
                      {["draft", "scheduled", "failed"].includes(c.status) && (
                        <Button
                          size="sm"
                          onClick={() => handleSend(c._id)}
                          disabled={actionIds.has(c._id)}
                        >
                          {actionIds.has(c._id) ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                          ) : (
                            <Send className="h-3.5 w-3.5 mr-1" />
                          )}
                          Send now
                        </Button>
                      )}
                      {c.status === "sent" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStats(c._id)}
                          disabled={actionIds.has(c._id)}
                        >
                          <BarChart3 className="h-3.5 w-3.5 mr-1" />
                          Refresh stats
                        </Button>
                      )}
                      {canMutate && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(c._id)}
                          disabled={actionIds.has(c._id)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground grid gap-1 sm:grid-cols-4">
                  <div>Recipients (send): {totals.recipients}</div>
                  <div>Sent: {totals.sent}</div>
                  <div>Unique opens: {totals.opens}</div>
                  <div>Unique clicks: {totals.clicks}</div>
                  {c.scheduledAt && (
                    <div className="sm:col-span-4">
                      Scheduled: {new Date(c.scheduledAt).toLocaleString()}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
            })}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1 || loading}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= totalPages || loading}
                onClick={() =>
                  setPage((current) => Math.min(totalPages, current + 1))
                }
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit campaign" : "New campaign"}</DialogTitle>
            <DialogDescription>
              Audience is a closed set: promotions-opted-in subscribers matching region / service /
              locale filters.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Spring promo BE"
                />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={form.type}
                  onValueChange={(v: CampaignType) => setForm((f) => ({ ...f, type: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newsletter">Newsletter</SelectItem>
                    <SelectItem value="promotion">Promotion</SelectItem>
                    <SelectItem value="reengagement">Re-engagement</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Countries (comma ISO, empty = all)</Label>
                <Input
                  value={form.countries}
                  onChange={(e) => setForm((f) => ({ ...f, countries: e.target.value }))}
                  placeholder="BE, NL, FR"
                />
              </div>
              <div className="space-y-2">
                <Label>Interested services (comma, empty = all)</Label>
                <Input
                  value={form.interestedServices}
                  onChange={(e) => setForm((f) => ({ ...f, interestedServices: e.target.value }))}
                  placeholder="Plumbing, Painting"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-4">
              {LOCALES.map((locale) => (
                <label key={locale} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.locales.includes(locale)}
                    onCheckedChange={(checked) =>
                      setForm((f) => ({
                        ...f,
                        locales: checked
                          ? Array.from(new Set([...f.locales, locale]))
                          : f.locales.length > 1
                            ? f.locales.filter((l) => l !== locale)
                            : f.locales,
                      }))
                    }
                  />
                  Audience locale {locale.toUpperCase()}
                </label>
              ))}
            </div>

            <div className="flex flex-wrap gap-4">
              {(["customer", "professional"] as const).map((role) => (
                <label key={role} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.roles.includes(role)}
                    onCheckedChange={(checked) =>
                      setForm((f) => ({
                        ...f,
                        roles: checked
                          ? Array.from(new Set([...f.roles, role]))
                          : f.roles.length > 1
                            ? f.roles.filter((r) => r !== role)
                            : f.roles,
                      }))
                    }
                  />
                  {role}
                </label>
              ))}
            </div>

            {form.type === "reengagement" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Inactive days</Label>
                  <Input
                    type="number"
                    min={1}
                    value={form.inactiveDays}
                    onChange={(e) => setForm((f) => ({ ...f, inactiveDays: e.target.value }))}
                  />
                </div>
                <label className="flex items-center gap-2 text-sm mt-7">
                  <Checkbox
                    checked={form.autoSend}
                    onCheckedChange={(checked) =>
                      setForm((f) => ({ ...f, autoSend: Boolean(checked) }))
                    }
                  />
                  Auto-send via daily cron
                </label>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Schedule (optional)</Label>
                <Input
                  type="datetime-local"
                  value={form.scheduledAt}
                  onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>UTM campaign</Label>
                <Input
                  value={form.utmCampaign}
                  onChange={(e) => setForm((f) => ({ ...f, utmCampaign: e.target.value }))}
                  placeholder="spring_2026"
                />
              </div>
            </div>

            <div className="flex gap-2 border-b">
              {LOCALES.map((locale) => (
                <button
                  key={locale}
                  type="button"
                  className={`px-3 py-2 text-sm ${
                    activeLocaleTab === locale
                      ? "border-b-2 border-foreground font-medium"
                      : "text-muted-foreground"
                  }`}
                  onClick={() => setActiveLocaleTab(locale)}
                >
                  {locale.toUpperCase()}
                  {form.content[locale].subject ? " ✓" : ""}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Subject ({activeLocaleTab})</Label>
                <Input
                  value={form.content[activeLocaleTab].subject}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      content: {
                        ...f.content,
                        [activeLocaleTab]: {
                          ...f.content[activeLocaleTab],
                          subject: e.target.value,
                        },
                      },
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Preview text</Label>
                <Input
                  value={form.content[activeLocaleTab].previewText || ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      content: {
                        ...f.content,
                        [activeLocaleTab]: {
                          ...f.content[activeLocaleTab],
                          previewText: e.target.value,
                        },
                      },
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>HTML body</Label>
                <Textarea
                  className="min-h-[160px] font-mono text-xs"
                  value={form.content[activeLocaleTab].htmlContent}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      content: {
                        ...f.content,
                        [activeLocaleTab]: {
                          ...f.content[activeLocaleTab],
                          htmlContent: e.target.value,
                        },
                      },
                    }))
                  }
                  placeholder="<h1>Hello</h1><p>...</p>"
                />
              </div>
              <div className="space-y-2">
                <Label>Brevo template</Label>
                <Select
                  value={String(form.content[activeLocaleTab].brevoTemplateId || "inline")}
                  disabled={templatesLoading}
                  onValueChange={(value) =>
                    setForm((f) => ({
                      ...f,
                      content: {
                        ...f.content,
                        [activeLocaleTab]: {
                          ...f.content[activeLocaleTab],
                          brevoTemplateId: value === "inline" ? undefined : Number(value),
                          subject:
                            f.content[activeLocaleTab].subject ||
                            templates?.find((template) => String(template.id) === value)?.subject ||
                            "",
                        },
                      },
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={templatesLoading ? "Loading templates..." : "Use inline HTML"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inline">Use inline HTML</SelectItem>
                    {form.content[activeLocaleTab].brevoTemplateId &&
                      !(templates || []).some(
                        (template) =>
                          template.id ===
                          form.content[activeLocaleTab].brevoTemplateId,
                      ) && (
                        <SelectItem
                          value={String(
                            form.content[activeLocaleTab].brevoTemplateId,
                          )}
                        >
                          Template #
                          {form.content[activeLocaleTab].brevoTemplateId} (inactive)
                        </SelectItem>
                      )}
                    {(templates || []).map((template) => (
                      <SelectItem key={template.id} value={String(template.id)}>
                        {template.name} (#{template.id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button type="button" variant="outline" onClick={previewAudience} disabled={audienceLoading}>
                {audienceLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Preview audience
              </Button>
              {audiencePreview && (
                <span
                  className={
                    audiencePreview.truncated
                      ? "text-sm text-rose-600"
                      : "text-sm text-muted-foreground"
                  }
                >
                  {audiencePreview.count} matching subscribers
                  {audiencePreview.truncated ? " (over 5,000 limit)" : ""}
                </span>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
