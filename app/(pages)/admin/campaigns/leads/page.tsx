"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { EU_COUNTRIES } from "@/lib/countries";
import { authFetch } from "@/lib/utils";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { ArrowDown, ArrowUp, CheckCircle2, FileSpreadsheet, Loader2, Pencil, Search, Trash2, Upload, Users } from "lucide-react";
import { toast } from "sonner";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "";
const LANGUAGES = ["en", "nl", "fr", "de"];
const MAX_FILE_BYTES = 5 * 1024 * 1024;

type Lead = { _id: string; email: string; firstName?: string; lastName?: string; country: string; locale: string; serviceKeys?: string[]; status: "active" | "deleted"; createdAt?: string; updatedAt?: string };
type ImportRecord = { _id: string; filename: string; status: string; totalRows: number; validRows: number; insertedRows: number; updatedRows: number; duplicateRows: number; rejectedRows: number; plannedInsertedRows?: number; plannedUpdatedRows?: number; plannedDuplicateRows?: number; errors?: { row: number; field?: string; message: string }[]; uploadedAt?: string; committedAt?: string };
type Validation = { headers?: string[]; totalRows: number; validRows: number; duplicateRows: number; rejectedRows: number; willInsert?: number; willUpdate?: number; willDuplicate?: number; errors?: { row: number; field?: string; message: string }[]; rows?: { rowNumber: number; email: string; country: string; locale: string; serviceKeys: string[] }[] };
type SortField = "createdAt" | "updatedAt" | "email" | "country" | "locale";

function apiBase() { if (!API_BASE) throw new Error("NEXT_PUBLIC_BACKEND_URL is not configured"); return API_BASE; }
function message(error: unknown, fallback: string) { return error instanceof Error && error.message ? error.message : fallback; }
function date(value?: string) { return value ? new Date(value).toLocaleString() : "—"; }

export default function MarketingLeadsPage() {
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { canAccessPath } = useAdminAccess();
  const allowed = !authLoading && Boolean(isAuthenticated && user?.role === "admin") && canAccessPath("/admin/campaigns/leads");
  const fileInput = useRef<HTMLInputElement>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [imports, setImports] = useState<ImportRecord[]>([]);
  const [filters, setFilters] = useState({ q: "", country: "all", locale: "all", service: "all", status: "active" });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [sort, setSort] = useState<SortField>("createdAt");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [committing, setCommitting] = useState<string | null>(null);
  const [validation, setValidation] = useState<Validation | null>(null);
  const [validatedImport, setValidatedImport] = useState<ImportRecord | null>(null);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (!authLoading && !isAuthenticated) router.replace("/login"); else if (!authLoading && isAuthenticated && user?.role !== "admin") router.replace("/dashboard"); else if (!authLoading && isAuthenticated && !allowed) router.replace("/dashboard"); }, [allowed, authLoading, isAuthenticated, router, user?.role]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "25", sort, direction, status: filters.status });
      if (filters.q.trim()) params.set("q", filters.q.trim());
      if (filters.country !== "all") params.set("country", filters.country);
      if (filters.locale !== "all") params.set("locale", filters.locale);
      if (filters.service !== "all") params.set("serviceKey", filters.service);
      const [leadsResponse, importsResponse] = await Promise.all([authFetch(`${apiBase()}/api/admin/marketing-leads?${params.toString()}`), authFetch(`${apiBase()}/api/admin/marketing-lead-imports`)]);
      const leadsJson = await leadsResponse.json().catch(() => null); const importsJson = await importsResponse.json().catch(() => null);
      if (!leadsResponse.ok || !leadsJson?.success) throw new Error(leadsJson?.msg || "Failed to load leads");
      if (!importsResponse.ok || !importsJson?.success) throw new Error(importsJson?.msg || "Failed to load import history");
      setLeads(leadsJson.data?.leads || []); setTotal(Number(leadsJson.data?.pagination?.total) || 0); setTotalPages(Math.max(1, Number(leadsJson.data?.pagination?.totalPages) || 1)); setImports(importsJson.data?.imports || []);
    } catch (error) { toast.error(message(error, "Failed to load leads")); }
    finally { setLoading(false); }
  }, [direction, filters, page, sort]);

  useEffect(() => { if (allowed) void load(); }, [allowed, load]);
  useEffect(() => { setPage(1); }, [filters, sort, direction]);

  const countryOptions = useMemo(() => EU_COUNTRIES.map((country) => ({ value: country.code, label: `${country.name} (${country.code})` })), []);
  const setSortField = (field: SortField) => { if (sort === field) setDirection((current) => current === "asc" ? "desc" : "asc"); else { setSort(field); setDirection("asc"); } };

  const validateFile = async (file: File) => {
    if (!/\.(xlsx|xls)$/i.test(file.name)) { toast.error("Upload an .xlsx or .xls workbook"); return; }
    if (file.size > MAX_FILE_BYTES) { toast.error("The workbook must be 5 MB or smaller"); return; }
    setUploading(true); setValidation(null); setValidatedImport(null);
    try {
      const form = new FormData(); form.append("file", file);
      const response = await authFetch(`${apiBase()}/api/admin/marketing-lead-imports/validate`, { method: "POST", body: form });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.success) throw new Error(json?.msg || "Workbook validation failed");
      setValidation(json.data?.validation || null); setValidatedImport(json.data?.import || null); toast.success("Workbook validated; review it before committing"); await load();
    } catch (error) { toast.error(message(error, "Workbook validation failed")); }
    finally { setUploading(false); if (fileInput.current) fileInput.current.value = ""; }
  };

  const commitImport = async (id: string) => {
    setCommitting(id);
    try { const response = await authFetch(`${apiBase()}/api/admin/marketing-lead-imports/${id}/commit`, { method: "POST" }); const json = await response.json().catch(() => null); if (!response.ok || !json?.success) throw new Error(json?.msg || "Import commit failed"); toast.success("Lead import committed"); setValidation(null); setValidatedImport(null); await load(); }
    catch (error) { toast.error(message(error, "Import commit failed")); } finally { setCommitting(null); }
  };

  const saveLead = async () => {
    if (!editing) return; setSaving(true);
    try { const response = await authFetch(`${apiBase()}/api/admin/marketing-leads/${editing._id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ firstName: editing.firstName || "", lastName: editing.lastName || "", country: editing.country, locale: editing.locale, serviceKeys: editing.serviceKeys || [] }) }); const json = await response.json().catch(() => null); if (!response.ok || !json?.success) throw new Error(json?.msg || "Lead update failed"); toast.success("Lead updated"); setEditing(null); await load(); }
    catch (error) { toast.error(message(error, "Lead update failed")); } finally { setSaving(false); }
  };

  const deleteLead = async (id: string) => { if (!confirm("Soft-delete this lead? It will no longer be eligible for campaigns.")) return; try { const response = await authFetch(`${apiBase()}/api/admin/marketing-leads/${id}`, { method: "DELETE" }); const json = await response.json().catch(() => null); if (!response.ok || !json?.success) throw new Error(json?.msg || "Lead deletion failed"); toast.success("Lead soft-deleted"); await load(); } catch (error) { toast.error(message(error, "Lead deletion failed")); } };

  if (authLoading || !allowed) return <div className="p-8"><Skeleton className="mb-4 h-10 w-64" /><Skeleton className="h-48 w-full" /></div>;

  return <div className="mx-auto max-w-7xl space-y-6 p-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-semibold tracking-tight">Marketing leads</h1><p className="mt-1 text-sm text-muted-foreground">Import, review, and maintain invitation leads separately from consented subscribers.</p></div><Button variant="outline" onClick={() => router.push("/admin/campaigns")}><Users className="mr-2 h-4 w-4" />Campaigns</Button></div>
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5" />Import leads</CardTitle><CardDescription>Required columns: Email, Country, Language, Service. Optional columns: First name, Last name. Workbooks are limited to 5 MB and 5,000 rows.</CardDescription></CardHeader><CardContent className="space-y-4"><input ref={fileInput} className="hidden" type="file" accept=".xlsx,.xls" onChange={(event) => { const file = event.target.files?.[0]; if (file) void validateFile(file); }} /><Button onClick={() => fileInput.current?.click()} disabled={uploading}>{uploading ? <Loader2 className="mr-2 h-4 w-4" /> : <Upload className="mr-2 h-4 w-4" />}Choose workbook</Button>{validation && <div className="rounded-lg border bg-muted/20 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-medium">Validation preview{validatedImport ? `: ${validatedImport.filename}` : ""}</h3><p className="text-sm text-muted-foreground">{validation.totalRows} rows · {validation.validRows} valid · {validation.willInsert ?? 0} to insert · {validation.willUpdate ?? 0} to update · {validation.willDuplicate ?? validation.duplicateRows} duplicates · {validation.rejectedRows} rejected</p></div>{validatedImport && <Button onClick={() => void commitImport(validatedImport._id)} disabled={committing === validatedImport._id || validation.validRows === 0}>{committing === validatedImport._id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}Commit valid leads</Button>}</div>{validation.errors?.length ? <div className="mt-3 max-h-40 overflow-auto rounded border bg-background p-3 text-sm">{validation.errors.slice(0, 50).map((error, index) => <div key={`${error.row}-${error.field}-${index}`} className="text-rose-600">Row {error.row}{error.field ? ` · ${error.field}` : ""}: {error.message}</div>)}</div> : <p className="mt-3 text-sm text-emerald-700">All workbook rows passed validation.</p>}{validation.rows?.length ? <div className="mt-3 overflow-auto"><Table><TableHeader><TableRow><TableHead>Row</TableHead><TableHead>Email</TableHead><TableHead>Country</TableHead><TableHead>Language</TableHead><TableHead>Services</TableHead></TableRow></TableHeader><TableBody>{validation.rows.slice(0, 25).map((row) => <TableRow key={row.rowNumber}><TableCell>{row.rowNumber}</TableCell><TableCell>{row.email}</TableCell><TableCell>{row.country}</TableCell><TableCell>{row.locale.toUpperCase()}</TableCell><TableCell>{row.serviceKeys.join(", ")}</TableCell></TableRow>)}</TableBody></Table>{validation.rows.length > 25 && <p className="mt-2 text-xs text-muted-foreground">Showing the first 25 valid rows.</p>}</div> : null}</div>}</CardContent></Card>
    <Card><CardHeader><CardTitle>Import history</CardTitle><CardDescription>Every validation and commit is retained for auditability.</CardDescription></CardHeader><CardContent className="p-0">{imports.length === 0 ? <p className="p-6 text-sm text-muted-foreground">No lead imports yet.</p> : <Table><TableHeader><TableRow><TableHead>File</TableHead><TableHead>Status</TableHead><TableHead>Rows</TableHead><TableHead>Result</TableHead><TableHead>Uploaded</TableHead><TableHead>Action</TableHead></TableRow></TableHeader><TableBody>{imports.map((item) => <TableRow key={item._id}><TableCell className="font-medium">{item.filename}</TableCell><TableCell><Badge variant={item.status === "committed" ? "secondary" : item.status === "failed" ? "destructive" : "outline"}>{item.status}</Badge></TableCell><TableCell>{item.totalRows}</TableCell><TableCell>{item.validRows} valid · {item.rejectedRows} rejected · {item.status === "committed" ? `${item.duplicateRows} duplicates` : `${item.plannedDuplicateRows ?? item.duplicateRows} duplicates`}{item.status === "committed" ? <div className="text-xs text-muted-foreground">{item.insertedRows} inserted · {item.updatedRows} updated</div> : <div className="text-xs text-muted-foreground">{item.plannedInsertedRows ?? 0} to insert · {item.plannedUpdatedRows ?? 0} to update</div>}</TableCell><TableCell className="whitespace-nowrap">{date(item.uploadedAt)}</TableCell><TableCell>{item.status === "validated" && <Button size="sm" onClick={() => void commitImport(item._id)} disabled={committing === item._id}>{committing === item._id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Commit"}</Button>}</TableCell></TableRow>)}</TableBody></Table>}</CardContent></Card>
    <Card><CardHeader><CardTitle>Leads <span className="text-base font-normal text-muted-foreground">({total})</span></CardTitle></CardHeader><CardContent className="space-y-4"><div className="grid gap-3 md:grid-cols-[1.5fr_repeat(4,1fr)]"><div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search name or email" value={filters.q} onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))} /></div><Select value={filters.country} onValueChange={(country) => setFilters((current) => ({ ...current, country }))}><SelectTrigger><SelectValue placeholder="Country" /></SelectTrigger><SelectContent><SelectItem value="all">All countries</SelectItem>{countryOptions.map((country) => <SelectItem key={country.value} value={country.value}>{country.label}</SelectItem>)}</SelectContent></Select><Select value={filters.locale} onValueChange={(locale) => setFilters((current) => ({ ...current, locale }))}><SelectTrigger><SelectValue placeholder="Language" /></SelectTrigger><SelectContent><SelectItem value="all">All languages</SelectItem>{LANGUAGES.map((locale) => <SelectItem key={locale} value={locale}>{locale.toUpperCase()}</SelectItem>)}</SelectContent></Select><Input placeholder="Service key" value={filters.service === "all" ? "" : filters.service} onChange={(event) => setFilters((current) => ({ ...current, service: event.target.value || "all" }))} /><Select value={filters.status} onValueChange={(status) => setFilters((current) => ({ ...current, status }))}><SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="deleted">Deleted</SelectItem></SelectContent></Select></div>
      {loading ? <div className="space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div> : leads.length === 0 ? <p className="text-sm text-muted-foreground">No leads match these filters.</p> : <Table><TableHeader><TableRow>{(["email", "country", "locale", "createdAt"] as SortField[]).map((field) => <TableHead key={field}><button type="button" className="flex items-center gap-1" onClick={() => setSortField(field)}>{field === "createdAt" ? "Created" : field[0].toUpperCase() + field.slice(1)}{sort === field && (direction === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}</button></TableHead>)}<TableHead>Name</TableHead><TableHead>Services</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader><TableBody>{leads.map((lead) => <TableRow key={lead._id}><TableCell className="font-medium">{lead.email}</TableCell><TableCell>{lead.country}</TableCell><TableCell>{lead.locale.toUpperCase()}</TableCell><TableCell className="whitespace-nowrap">{date(lead.createdAt)}</TableCell><TableCell>{[lead.firstName, lead.lastName].filter(Boolean).join(" ") || "—"}</TableCell><TableCell>{lead.serviceKeys?.join(", ") || "—"}</TableCell><TableCell><div className="flex gap-1"><Button size="sm" variant="outline" onClick={() => setEditing({ ...lead, serviceKeys: [...(lead.serviceKeys || [])] })} disabled={lead.status === "deleted"}><Pencil className="h-3.5 w-3.5" /></Button>{lead.status === "active" && <Button size="sm" variant="ghost" onClick={() => void deleteLead(lead._id)}><Trash2 className="h-3.5 w-3.5 text-rose-500" /></Button>}</div></TableCell></TableRow>)}</TableBody></Table>}
      {totalPages > 1 && <div className="flex items-center justify-between"><Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)}>Previous</Button><span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span><Button variant="outline" size="sm" disabled={page >= totalPages || loading} onClick={() => setPage((current) => current + 1)}>Next</Button></div>}
    </CardContent></Card>
    <Dialog open={Boolean(editing)} onOpenChange={(open) => { if (!open) setEditing(null); }}><DialogContent><DialogHeader><DialogTitle>Edit lead</DialogTitle><DialogDescription>Update lead metadata. Email is immutable.</DialogDescription></DialogHeader>{editing && <div className="space-y-4"><div className="space-y-2"><Label>Email</Label><Input value={editing.email} disabled /></div><div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><Label>First name</Label><Input value={editing.firstName || ""} onChange={(event) => setEditing((current) => current ? { ...current, firstName: event.target.value } : current)} /></div><div className="space-y-2"><Label>Last name</Label><Input value={editing.lastName || ""} onChange={(event) => setEditing((current) => current ? { ...current, lastName: event.target.value } : current)} /></div></div><div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><Label>Country</Label><Select value={editing.country} onValueChange={(country) => setEditing((current) => current ? { ...current, country } : current)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{countryOptions.map((country) => <SelectItem key={country.value} value={country.value}>{country.label}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Language</Label><Select value={editing.locale} onValueChange={(locale) => setEditing((current) => current ? { ...current, locale } : current)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{LANGUAGES.map((locale) => <SelectItem key={locale} value={locale}>{locale.toUpperCase()}</SelectItem>)}</SelectContent></Select></div></div><div className="space-y-2"><Label>Service keys</Label><Input value={(editing.serviceKeys || []).join(", ")} onChange={(event) => setEditing((current) => current ? { ...current, serviceKeys: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) } : current)} /></div></div>}<DialogFooter><Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button><Button onClick={() => void saveLead()} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save changes</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
