"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { CalendarClock, Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useErrorMessage } from "@/lib/i18n/useErrorMessage";
import { useFormatLocale } from "@/lib/i18n/useFormatLocale";
import { listSupportAvailability, type SupportSlot } from "@/lib/support";
import {
  formatSupportDateOnly,
  formatSupportDateTime,
  formatSupportTime,
  groupSupportSlotsByDate,
  resolveSupportTimeZone,
  supportDateWindow,
} from "@/lib/support/dates";
import { SupportErrorBanner } from "@/components/support/supportUi";

interface SupportSlotPickerProps {
  idPrefix: string;
  timeZone: string;
  refreshKey?: number;
  selected: SupportSlot | null;
  disabled?: boolean;
  onSelect: (slot: SupportSlot | null) => void;
}

export default function SupportSlotPicker({
  idPrefix,
  timeZone,
  refreshKey = 0,
  selected,
  disabled,
  onSelect,
}: SupportSlotPickerProps) {
  const t = useTranslations("support");
  const getErrorText = useErrorMessage();
  const { intl } = useFormatLocale();
  const viewerTimeZone = useMemo(() => resolveSupportTimeZone(timeZone), [timeZone]);
  const [slots, setSlots] = useState<SupportSlot[]>([]);
  const [displayTimeZone, setDisplayTimeZone] = useState(viewerTimeZone);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [activeDate, setActiveDate] = useState<string | null>(null);

  const windowDates = useMemo(
    () => supportDateWindow(viewerTimeZone, 21),
    [viewerTimeZone],
  );

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const range = supportDateWindow(viewerTimeZone, 21);
    listSupportAvailability({
      from: range.from,
      to: range.to,
      timeZone: viewerTimeZone,
      signal: controller.signal,
    })
      .then((data) => {
        if (controller.signal.aborted) return;
        const zone = resolveSupportTimeZone(data.timeZone || viewerTimeZone);
        setDisplayTimeZone(zone);
        setSlots(Array.isArray(data.slots) ? data.slots : []);
      })
      .catch((requestError) => {
        if (controller.signal.aborted) return;
        setSlots([]);
        setError(getErrorText(requestError, t("meeting.slotsFailed")));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [viewerTimeZone, refreshKey, reloadKey, getErrorText, t]);

  const grouped = useMemo(
    () => groupSupportSlotsByDate(slots, displayTimeZone),
    [slots, displayTimeZone],
  );

  useEffect(() => {
    const firstAvailable = windowDates.dates.find(
      (date) => (grouped.get(date) || []).length > 0,
    );
    setActiveDate((current) => {
      if (current && (grouped.get(current) || []).length > 0) return current;
      if (selected) {
        const selectedDate = groupSupportSlotsByDate([selected], displayTimeZone).keys().next()
          .value;
        if (selectedDate) return selectedDate;
      }
      return firstAvailable || windowDates.dates[0] || null;
    });
  }, [grouped, windowDates.dates, selected, displayTimeZone]);

  // A refresh can drop the previously selected slot; clear it so the UI never
  // shows (and submits) a slot the server no longer offers.
  useEffect(() => {
    if (loading || error || !selected) return;
    if (!slots.some((slot) => slot.start === selected.start)) onSelect(null);
  }, [slots, loading, error, selected, onSelect]);

  const visibleSlots = activeDate ? grouped.get(activeDate) || [] : [];

  return (
    <fieldset className="min-w-0 space-y-3" disabled={disabled}>
      <legend className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
        {t("meeting.slotTitle")}
      </legend>
      <p className="text-xs text-indigo-500">
        {t("meeting.slotHint", { timeZone: displayTimeZone })}
      </p>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50/40 py-8 text-sm text-indigo-500">
          <Loader2 size={17} aria-hidden className="animate-spin" />
          {t("meeting.slotsLoading")}
        </div>
      ) : error ? (
        <SupportErrorBanner
          message={error}
          onRetry={() => setReloadKey((value) => value + 1)}
        />
      ) : slots.length === 0 ? (
        <div className="rounded-xl border border-dashed border-indigo-200 bg-indigo-50/40 px-4 py-6 text-center text-sm text-indigo-500">
          {t("meeting.slotsEmpty")}
        </div>
      ) : (
        <>
          <div
            className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-2"
            aria-label={t("meeting.dateStripLabel")}
          >
            {windowDates.dates.map((date) => {
              const count = (grouped.get(date) || []).length;
              const active = date === activeDate;
              return (
                <button
                  key={date}
                  type="button"
                  onClick={() => setActiveDate(date)}
                  disabled={count === 0}
                  aria-pressed={active}
                  className={cn(
                    "flex min-h-14 min-w-[4.75rem] snap-start flex-col items-center justify-center rounded-xl border px-2 py-1.5 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400",
                    active
                      ? "border-transparent bg-gradient-to-br from-indigo-500 to-blue-500 text-white shadow-sm"
                      : count > 0
                        ? "border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50"
                        : "cursor-not-allowed border-indigo-100 bg-indigo-50/40 text-indigo-300",
                  )}
                >
                  <span>{formatSupportDateOnly(date, intl)}</span>
                  <span
                    className={cn(
                      "mt-0.5 text-[10px]",
                      active ? "text-indigo-100" : "text-indigo-400",
                    )}
                  >
                    {count > 0 ? t("meeting.slotsCount", { count }) : t("meeting.noSlotsForDay")}
                  </span>
                </button>
              );
            })}
          </div>

          <div
            role="radiogroup"
            aria-label={t("meeting.slotGroupLabel", {
              date: activeDate ? formatSupportDateOnly(activeDate, intl) : "",
            })}
            className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4"
          >
            {visibleSlots.map((slot) => {
              const active = selected?.start === slot.start;
              const label = formatSupportDateTime(slot.start, displayTimeZone, intl);
              return (
                <button
                  key={slot.start}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={label}
                  onClick={() => onSelect(active ? null : slot)}
                  className={cn(
                    "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400",
                    active
                      ? "border-transparent bg-gradient-to-r from-indigo-500 to-blue-500 text-white shadow-sm"
                      : "border-indigo-200 bg-white text-indigo-700 hover:border-indigo-300 hover:bg-indigo-50",
                  )}
                >
                  <CalendarClock size={14} aria-hidden />
                  {formatSupportTime(slot.start, displayTimeZone, intl)}
                </button>
              );
            })}
          </div>
        </>
      )}

      <div
        id={`${idPrefix}-slot-selected`}
        aria-live="polite"
        tabIndex={-1}
        className={cn(
          "rounded-xl px-3 py-2 text-xs",
          selected
            ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
            : "text-indigo-400",
        )}
      >
        {selected
          ? t("meeting.selectedSlot", {
              date: formatSupportDateTime(selected.start, displayTimeZone, intl),
              timeZone: displayTimeZone,
            })
          : t("meeting.slotNotSelected")}
      </div>

      {!loading && !error && slots.length > 0 && (
        <button
          type="button"
          onClick={() => setReloadKey((value) => value + 1)}
          disabled={disabled}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium text-indigo-500 transition hover:bg-indigo-50 hover:text-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
        >
          <RefreshCw size={11} aria-hidden />
          {t("meeting.refreshSlots")}
        </button>
      )}
    </fieldset>
  );
}
