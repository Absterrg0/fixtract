"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { AlertCircle, ExternalLink, FileText, Loader2, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SupportAttachmentDto, SupportDisplayStatus } from "@/lib/support";
import { isSafeSupportUrl } from "@/lib/support/validation";

export function SupportCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl bg-gradient-to-br from-indigo-100 via-blue-100 to-cyan-100 p-[1.5px] shadow-sm",
        className,
      )}
    >
      <div className="rounded-[calc(1rem-1.5px)] bg-white">{children}</div>
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  open: "bg-amber-100 text-amber-700",
  in_progress: "bg-blue-100 text-blue-700",
  resolved: "bg-emerald-100 text-emerald-700",
  closed: "bg-gray-100 text-gray-600",
  pending: "bg-amber-100 text-amber-700",
  scheduled: "bg-emerald-100 text-emerald-700",
  declined: "bg-rose-100 text-rose-700",
  cancelled: "bg-gray-100 text-gray-600",
  completed: "bg-indigo-100 text-indigo-700",
};

const STATUS_KEYS = new Set<string>([
  "open",
  "in_progress",
  "resolved",
  "closed",
  "pending",
  "scheduled",
  "declined",
  "cancelled",
  "completed",
]);

export function SupportStatusPill({
  status,
  label,
}: {
  status: SupportDisplayStatus | string;
  label?: string;
}) {
  const t = useTranslations("support");
  const display = label || (STATUS_KEYS.has(status)
    ? t(`status.${status as SupportDisplayStatus}`)
    : status.replace(/_/g, " "));
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        STATUS_STYLES[status] || "bg-gray-100 text-gray-600",
      )}
    >
      {display}
    </span>
  );
}

export const isSafeExternalUrl = isSafeSupportUrl;

export function formatSupportFileSize(bytes: number): string {
  const size = Number(bytes) || 0;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function SupportAttachmentLink({
  attachment,
  className,
}: {
  attachment: SupportAttachmentDto | null;
  className?: string;
}) {
  const t = useTranslations("support");
  if (!attachment) return null;
  const safeUrl = isSafeExternalUrl(attachment.url) ? attachment.url : null;
  const content = (
    <>
      <FileText size={14} aria-hidden />
      <span className="min-w-0 truncate">{attachment.fileName}</span>
      <span className="shrink-0 text-indigo-400">
        ({formatSupportFileSize(attachment.size)})
      </span>
      {safeUrl && <ExternalLink size={12} aria-hidden className="shrink-0" />}
    </>
  );

  return safeUrl ? (
    <a
      href={safeUrl}
      target="_blank"
      rel="noopener noreferrer"
      title={t("ticket.openAttachment")}
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50/70 px-2.5 py-1.5 text-xs text-indigo-700 transition hover:bg-indigo-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400",
        className,
      )}
    >
      {content}
    </a>
  ) : (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-lg border border-indigo-100 bg-indigo-50/50 px-2.5 py-1.5 text-xs text-indigo-600",
        className,
      )}
    >
      {content}
    </span>
  );
}

export function SupportEmailNotice({
  emailSent,
  sentLabel,
  failedLabel,
  className,
}: {
  emailSent: boolean | null | undefined;
  sentLabel?: string;
  failedLabel?: string;
  className?: string;
}) {
  const t = useTranslations("support");
  if (emailSent === null || emailSent === undefined) return null;
  return (
    <p
      role={emailSent ? "status" : "alert"}
      className={cn(
        "flex items-start gap-2 rounded-xl border px-3 py-2 text-xs",
        emailSent
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-amber-300 bg-amber-50 text-amber-900",
        className,
      )}
    >
      <AlertCircle size={14} aria-hidden className="mt-0.5 shrink-0" />
      <span>
        {emailSent
          ? sentLabel || t("common.emailSent")
          : failedLabel || t("common.emailSavedWarning")}
      </span>
    </p>
  );
}

export function SupportErrorBanner({
  message,
  onRetry,
  className,
}: {
  message: string;
  onRetry?: () => void;
  className?: string;
}) {
  const t = useTranslations("support");
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <span className="flex items-start gap-2">
        <AlertCircle size={16} aria-hidden className="mt-0.5 shrink-0" />
        {message}
      </span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex min-h-9 items-center gap-1.5 self-start rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 sm:self-auto"
        >
          <RotateCcw size={13} aria-hidden />
          {t("common.retry")}
        </button>
      )}
    </div>
  );
}

export function SupportLoading({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-indigo-500">
      <Loader2 size={18} aria-hidden className="animate-spin" />
      <span>{label}</span>
    </div>
  );
}

export function SupportEmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-indigo-300 bg-gradient-to-br from-indigo-50 via-blue-50 to-white px-5 py-10 text-center text-sm text-indigo-500">
      {children}
    </div>
  );
}
