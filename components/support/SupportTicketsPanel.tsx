"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { useErrorMessage } from "@/lib/i18n/useErrorMessage";
import { useFormatLocale } from "@/lib/i18n/useFormatLocale";
import {
  createSupportItem,
  listSupportItems,
  type SupportItem,
  type SupportLocale,
  type SupportPagination,
  SUPPORT_MAX_PAGE,
} from "@/lib/support";
import type { SupportReasonOption } from "@/lib/support/reasons";
import { supportReasonKey } from "@/lib/support/reasons";
import SupportRequestFields, {
  type SupportFieldErrors,
} from "@/components/support/SupportRequestFields";
import SupportReplySection from "@/components/support/SupportReplySection";
import {
  SupportAttachmentLink,
  SupportCard,
  SupportEmailNotice,
  SupportEmptyState,
  SupportErrorBanner,
  SupportLoading,
  SupportStatusPill,
} from "@/components/support/supportUi";

const PAGE_SIZE = 10;

function mergeItems(current: SupportItem[], next: SupportItem[]): SupportItem[] {
  const seen = new Set(current.map((item) => `${item.kind}:${item._id || item.id}`));
  return [
    ...current,
    ...next.filter((item) => !seen.has(`${item.kind}:${item._id || item.id}`)),
  ];
}

function appLocale(value: string): SupportLocale {
  return value === "nl" || value === "fr" ? value : "en";
}

export default function SupportTicketsPanel({
  reasonOptions,
}: {
  reasonOptions: SupportReasonOption[];
}) {
  const t = useTranslations("support");
  const locale = useLocale();
  const getErrorText = useErrorMessage();
  const [items, setItems] = useState<SupportItem[] | null>(null);
  const [pagination, setPagination] = useState<SupportPagination | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [reason, setReason] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [bookingId, setBookingId] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [errors, setErrors] = useState<SupportFieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [acknowledgements, setAcknowledgements] = useState<
    Record<string, boolean | null>
  >({});

  useEffect(() => {
    const controller = new AbortController();
    if (page === 1) setLoading(true);
    else setLoadingMore(true);
    setLoadError(null);
    listSupportItems({
      kind: "ticket",
      page,
      limit: PAGE_SIZE,
      signal: controller.signal,
    })
      .then((result) => {
        if (controller.signal.aborted) return;
        setItems((current) =>
          page === 1 ? result.items : mergeItems(current || [], result.items),
        );
        setPagination(result.pagination);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setLoadError(getErrorText(error, t("ticket.loadFailed")));
        setItems((current) => current ?? []);
      })
      .finally(() => {
        if (controller.signal.aborted) return;
        setLoading(false);
        setLoadingMore(false);
      });
    return () => controller.abort();
  }, [page, reloadKey, getErrorText, t]);

  const retry = () => {
    if (page !== 1) {
      setPage(1);
      setReloadKey((value) => value + 1);
    } else {
      setReloadKey((value) => value + 1);
    }
  };

  const resetForm = () => {
    setReason("");
    setSubject("");
    setDescription("");
    setBookingId("");
    setAttachment(null);
    setAttachmentError(null);
    setErrors({});
  };

  const focusFirstInvalid = (nextErrors: SupportFieldErrors) => {
    const order: Array<keyof SupportFieldErrors> = [
      "reason",
      "subject",
      "description",
      "attachment",
    ];
    const first = order.find((field) => nextErrors[field]);
    if (first) document.getElementById(`ticket-${first}`)?.focus();
  };

  const submit = async () => {
    if (saving) return;
    const nextErrors: SupportFieldErrors = {};
    if (!reason) nextErrors.reason = t("form.reasonRequired");
    if (!subject.trim()) nextErrors.subject = t("form.subjectRequired");
    if (!description.trim()) nextErrors.description = t("form.descriptionRequired");
    if (attachmentError) nextErrors.attachment = attachmentError;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      focusFirstInvalid(nextErrors);
      return;
    }

    setSaving(true);
    try {
      const { item, emailSent } = await createSupportItem({
        kind: "ticket",
        reason,
        subject,
        description,
        bookingId: bookingId || undefined,
        locale: appLocale(locale),
        attachment,
      });
      const itemKey = item._id || item.id;
      setItems((current) => [item, ...(current || [])]);
      setPagination((current) =>
        current
          ? {
              ...current,
              total: current.total + 1,
              totalPages: Math.max(1, Math.ceil((current.total + 1) / current.limit)),
            }
          : current,
      );
      setAcknowledgements((current) => ({ ...current, [itemKey]: emailSent }));
      resetForm();
      const number = item.ticketNumber;
      toast.success(
        number
          ? t("ticket.created", { ticketNumber: number })
          : t("ticket.createdGeneric"),
      );
      if (emailSent === false) {
        toast.warning(
          number
            ? t("ticket.ackFailed", { ticketNumber: number })
            : t("common.emailSavedWarning"),
        );
      }
    } catch (error) {
      toast.error(getErrorText(error, t("ticket.createFailed")));
    } finally {
      setSaving(false);
    }
  };

  const updateItem = (next: SupportItem) => {
    setItems((current) =>
      current
        ? current.map((item) =>
            (item.kind === next.kind && (item._id || item.id) === (next._id || next.id))
              ? next
              : item,
          )
        : current,
    );
  };

  return (
    <div className="space-y-5">
      <SupportCard>
        <form
          className="space-y-4 p-5 sm:p-6"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
          noValidate
        >
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-indigo-700">
              {t("ticket.new")}
            </h2>
            <p className="mt-1 text-xs text-indigo-500">{t("ticket.newHint")}</p>
          </div>
          <SupportRequestFields
            idPrefix="ticket"
            reasonOptions={reasonOptions}
            reason={reason}
            subject={subject}
            description={description}
            bookingId={bookingId}
            attachment={attachment}
            attachmentError={attachmentError}
            errors={errors}
            disabled={saving}
            onReasonChange={(value) => {
              setReason(value);
              setErrors((current) => ({ ...current, reason: undefined }));
            }}
            onSubjectChange={(value) => {
              setSubject(value);
              setErrors((current) => ({ ...current, subject: undefined }));
            }}
            onDescriptionChange={(value) => {
              setDescription(value);
              setErrors((current) => ({ ...current, description: undefined }));
            }}
            onBookingChange={setBookingId}
            onAttachmentChange={(file) => {
              setAttachment(file);
              setErrors((current) => ({ ...current, attachment: undefined }));
            }}
            onAttachmentError={setAttachmentError}
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 px-5 py-2 text-sm font-semibold text-white shadow-md shadow-indigo-200 transition hover:shadow-lg hover:shadow-indigo-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? (
                <Loader2 size={14} aria-hidden className="animate-spin" />
              ) : (
                <Plus size={14} aria-hidden />
              )}
              {saving ? t("ticket.creating") : t("ticket.create")}
            </button>
          </div>
        </form>
      </SupportCard>

      <section aria-labelledby="tickets-list-title" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2
            id="tickets-list-title"
            className="text-sm font-semibold uppercase tracking-wide text-indigo-700"
          >
            {t("ticket.listTitle")}
          </h2>
          {pagination && pagination.total > 0 && (
            <span className="text-xs text-indigo-400">
              {t("ticket.totalCount", { count: pagination.total })}
            </span>
          )}
        </div>

        {loadError && <SupportErrorBanner message={loadError} onRetry={retry} />}

        {items === null && loading ? (
          <SupportLoading label={t("common.loading")} />
        ) : items && items.length === 0 ? (
          <SupportEmptyState>{t("ticket.empty")}</SupportEmptyState>
        ) : (
          <div className="space-y-3">
            {(items || []).map((item) => (
              <TicketCard
                key={`${item.kind}:${item._id || item.id}`}
                item={item}
                emailSent={acknowledgements[item._id || item.id] ?? null}
                onUpdated={updateItem}
              />
            ))}
          </div>
        )}

        {pagination && page < Math.min(pagination.totalPages, SUPPORT_MAX_PAGE) && (
          <div className="flex justify-center pt-1">
            <button
              type="button"
              onClick={() => setPage((value) => value + 1)}
              disabled={loadingMore}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-indigo-200 bg-white px-4 py-2 text-sm font-medium text-indigo-700 transition hover:bg-indigo-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingMore && <Loader2 size={14} aria-hidden className="animate-spin" />}
              {loadingMore ? t("common.loading") : t("ticket.loadMore")}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function TicketCard({
  item,
  emailSent,
  onUpdated,
}: {
  item: SupportItem;
  emailSent: boolean | null;
  onUpdated: (item: SupportItem) => void;
}) {
  const t = useTranslations("support");
  const { intl } = useFormatLocale();
  const reasonKey = supportReasonKey(item.reason);
  const reasonLabel = reasonKey
    ? t(`reason.${reasonKey}`)
    : item.reasonLabel || "";

  return (
    <SupportCard>
      <article className="space-y-3 p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              {item.ticketNumber ? (
                <span className="rounded-md bg-indigo-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-indigo-700">
                  {item.ticketNumber}
                </span>
              ) : (
                <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                  {t("common.legacy")}
                </span>
              )}
              <SupportStatusPill status={item.status} />
            </div>
            <h3 className="break-words text-base font-semibold text-indigo-950">
              {item.subject}
            </h3>
          </div>
          <time
            dateTime={item.createdAt}
            className="shrink-0 text-[11px] text-indigo-400"
          >
            {new Intl.DateTimeFormat(intl, {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(new Date(item.createdAt))}
          </time>
        </div>

        {(reasonLabel || item.booking) && (
          <div className="flex flex-wrap gap-1.5 text-[11px]">
            {reasonLabel && (
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 font-medium text-indigo-700">
                {reasonLabel}
              </span>
            )}
            {item.booking && (
              <span className="max-w-full truncate rounded-full bg-blue-50 px-2 py-0.5 font-medium text-blue-700">
                {item.booking.label}
              </span>
            )}
          </div>
        )}

        {item.description && (
          <p className="whitespace-pre-wrap break-words text-sm text-indigo-800/85">
            {item.description}
          </p>
        )}
        <SupportAttachmentLink attachment={item.attachment} />
        <SupportEmailNotice emailSent={emailSent} />
        <SupportReplySection item={item} onUpdated={onUpdated} />
      </article>
    </SupportCard>
  );
}
