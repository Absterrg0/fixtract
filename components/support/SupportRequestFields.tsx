"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { FileUp, Loader2, Paperclip, RefreshCw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useErrorMessage } from "@/lib/i18n/useErrorMessage";
import { listSupportBookings, type SupportBookingOption } from "@/lib/support";
import type { SupportReasonOption } from "@/lib/support/reasons";
import { formatSupportFileSize } from "@/components/support/supportUi";
import { validateSupportAttachment } from "@/lib/support/validation";

export interface SupportFieldErrors {
  reason?: string;
  subject?: string;
  description?: string;
  attachment?: string;
}

interface SupportRequestFieldsProps {
  idPrefix: string;
  reasonOptions: SupportReasonOption[];
  reason: string;
  subject: string;
  description: string;
  bookingId: string;
  attachment: File | null;
  attachmentError: string | null;
  errors: SupportFieldErrors;
  disabled?: boolean;
  onReasonChange: (value: string) => void;
  onSubjectChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onBookingChange: (value: string) => void;
  onAttachmentChange: (file: File | null) => void;
  onAttachmentError: (message: string | null) => void;
}

export default function SupportRequestFields({
  idPrefix,
  reasonOptions,
  reason,
  subject,
  description,
  bookingId,
  attachment,
  attachmentError,
  errors,
  disabled,
  onReasonChange,
  onSubjectChange,
  onDescriptionChange,
  onBookingChange,
  onAttachmentChange,
  onAttachmentError,
}: SupportRequestFieldsProps) {
  const t = useTranslations("support");
  const getErrorText = useErrorMessage();
  const [bookings, setBookings] = useState<SupportBookingOption[] | null>(null);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [bookingsError, setBookingsError] = useState<string | null>(null);
  const [bookingsReload, setBookingsReload] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setBookingsLoading(true);
    setBookingsError(null);
    listSupportBookings(controller.signal)
      .then((items) => {
        if (!controller.signal.aborted) setBookings(items);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setBookings([]);
        setBookingsError(getErrorText(error, t("booking.loadFailed")));
      })
      .finally(() => {
        if (!controller.signal.aborted) setBookingsLoading(false);
      });
    return () => controller.abort();
  }, [bookingsReload, getErrorText, t]);

  const handleFile = useCallback(
    (file: File | null) => {
      if (!file) {
        onAttachmentChange(null);
        onAttachmentError(null);
        return;
      }
      const problem = validateSupportAttachment(file);
      if (problem) {
        onAttachmentChange(null);
        onAttachmentError(
          problem === "size" ? t("form.fileTooLarge") : t("form.fileType"),
        );
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      onAttachmentChange(file);
      onAttachmentError(null);
    },
    [onAttachmentChange, onAttachmentError, t],
  );

  const inputClasses = (invalid?: boolean) =>
    cn(
      "w-full rounded-xl border bg-white/70 px-4 py-2 text-sm text-indigo-950 outline-none transition placeholder:text-indigo-300 focus:bg-white focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60",
      invalid
        ? "border-rose-400 focus:border-rose-500 focus:ring-rose-200"
        : "border-indigo-200 focus:border-indigo-400 focus:ring-indigo-200",
    );

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label
          htmlFor={`${idPrefix}-reason`}
          className="block text-xs font-semibold uppercase tracking-wide text-indigo-700"
        >
          {t("reason.label")} <span aria-hidden className="text-rose-500">*</span>
        </label>
        <select
          id={`${idPrefix}-reason`}
          value={reason}
          onChange={(event) => onReasonChange(event.target.value)}
          disabled={disabled}
          aria-required="true"
          aria-invalid={Boolean(errors.reason)}
          aria-describedby={errors.reason ? `${idPrefix}-reason-error` : undefined}
          className={inputClasses(Boolean(errors.reason))}
        >
          <option value="">{t("reason.placeholder")}</option>
          {reasonOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.key ? t(`reason.${option.key}`) : option.label}
            </option>
          ))}
        </select>
        {errors.reason && (
          <p id={`${idPrefix}-reason-error`} className="text-xs text-rose-600">
            {errors.reason}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor={`${idPrefix}-booking`}
          className="block text-xs font-semibold uppercase tracking-wide text-indigo-700"
        >
          {t("booking.label")} <span className="font-normal normal-case text-indigo-400">({t("common.optional")})</span>
        </label>
        <select
          id={`${idPrefix}-booking`}
          value={bookingId}
          onChange={(event) => onBookingChange(event.target.value)}
          disabled={disabled || bookingsLoading}
          className={inputClasses()}
        >
          <option value="">{t("booking.none")}</option>
          {(bookings || []).map((booking) => (
            <option key={booking.bookingId} value={booking.bookingId}>
              {booking.label}
            </option>
          ))}
        </select>
        {bookingsLoading && (
          <p className="flex items-center gap-1.5 text-xs text-indigo-400">
            <Loader2 size={12} aria-hidden className="animate-spin" />
            {t("booking.loading")}
          </p>
        )}
        {bookingsError && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-amber-800">
            <span>{bookingsError}</span>
            <button
              type="button"
              onClick={() => setBookingsReload((value) => value + 1)}
              className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 font-medium transition hover:bg-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <RefreshCw size={11} aria-hidden />
              {t("booking.retry")}
            </button>
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor={`${idPrefix}-subject`}
          className="block text-xs font-semibold uppercase tracking-wide text-indigo-700"
        >
          {t("form.subject")} <span aria-hidden className="text-rose-500">*</span>
        </label>
        <input
          id={`${idPrefix}-subject`}
          value={subject}
          onChange={(event) => onSubjectChange(event.target.value)}
          placeholder={t("form.subjectPlaceholder")}
          maxLength={200}
          disabled={disabled}
          aria-required="true"
          aria-invalid={Boolean(errors.subject)}
          aria-describedby={errors.subject ? `${idPrefix}-subject-error` : undefined}
          className={inputClasses(Boolean(errors.subject))}
        />
        <div className="flex items-center justify-between gap-2">
          {errors.subject ? (
            <p id={`${idPrefix}-subject-error`} className="text-xs text-rose-600">
              {errors.subject}
            </p>
          ) : (
            <span />
          )}
          <span className="text-[10px] text-indigo-300">{subject.length}/200</span>
        </div>
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor={`${idPrefix}-description`}
          className="block text-xs font-semibold uppercase tracking-wide text-indigo-700"
        >
          {t("form.description")} <span aria-hidden className="text-rose-500">*</span>
        </label>
        <textarea
          id={`${idPrefix}-description`}
          value={description}
          onChange={(event) => onDescriptionChange(event.target.value)}
          placeholder={t("form.descriptionPlaceholder")}
          rows={4}
          maxLength={5000}
          disabled={disabled}
          aria-required="true"
          aria-invalid={Boolean(errors.description)}
          aria-describedby={errors.description ? `${idPrefix}-description-error` : undefined}
          className={cn(inputClasses(Boolean(errors.description)), "resize-y")}
        />
        <div className="flex items-center justify-between gap-2">
          {errors.description ? (
            <p id={`${idPrefix}-description-error`} className="text-xs text-rose-600">
              {errors.description}
            </p>
          ) : (
            <span />
          )}
          <span className="text-[10px] text-indigo-300">{description.length}/5000</span>
        </div>
      </div>

      <div className="space-y-1.5">
        <span className="block text-xs font-semibold uppercase tracking-wide text-indigo-700">
          {t("form.attachment")} <span className="font-normal normal-case text-indigo-400">({t("common.optional")})</span>
        </span>
        <div className="rounded-xl border border-dashed border-indigo-200 bg-indigo-50/40 p-3">
          {attachment ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex min-w-0 items-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-2.5 py-1.5 text-xs text-indigo-700">
                <Paperclip size={13} aria-hidden />
                <span className="max-w-[14rem] truncate">{attachment.name}</span>
                <span className="text-indigo-400">({formatSupportFileSize(attachment.size)})</span>
              </span>
              <label className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-2.5 py-1.5 text-xs font-medium text-indigo-700 transition hover:bg-indigo-50 focus-within:ring-2 focus-within:ring-indigo-300">
                <FileUp size={13} aria-hidden />
                {t("form.changeFile")}
                <input
                  ref={fileInputRef}
                  id={`${idPrefix}-attachment`}
                  type="file"
                  className="sr-only"
                  disabled={disabled}
                  aria-invalid={Boolean(attachmentError || errors.attachment)}
                  aria-describedby={`${idPrefix}-attachment-hint${attachmentError || errors.attachment ? ` ${idPrefix}-attachment-error` : ""}`}
                  onChange={(event) => handleFile(event.target.files?.[0] || null)}
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  handleFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                disabled={disabled}
                className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-rose-600 transition hover:bg-rose-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 disabled:opacity-50"
              >
                <X size={13} aria-hidden />
                {t("form.removeFile")}
              </button>
            </div>
          ) : (
            <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-indigo-600 focus-within:ring-2 focus-within:ring-indigo-300">
              <FileUp size={16} aria-hidden />
              <span className="font-medium">{t("form.chooseFile")}</span>
              <input
                ref={fileInputRef}
                id={`${idPrefix}-attachment`}
                type="file"
                className="sr-only"
                disabled={disabled}
                accept=".jpg,.jpeg,.png,.webp,.pdf,.txt,.doc,.docx,.xls,.xlsx"
                aria-invalid={Boolean(attachmentError || errors.attachment)}
                aria-describedby={`${idPrefix}-attachment-hint${attachmentError || errors.attachment ? ` ${idPrefix}-attachment-error` : ""}`}
                onChange={(event) => handleFile(event.target.files?.[0] || null)}
              />
            </label>
          )}
          <p id={`${idPrefix}-attachment-hint`} className="mt-1 text-[11px] text-indigo-400">{t("form.attachmentHint")}</p>
          {(attachmentError || errors.attachment) && (
            <p
              id={`${idPrefix}-attachment-error`}
              role="alert"
              className="mt-1 text-xs text-rose-600"
            >
              {attachmentError || errors.attachment}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
