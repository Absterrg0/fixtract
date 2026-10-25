"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarClock, Loader2, RefreshCw } from "lucide-react";
import { getErrorMessage } from "@/lib/apiErrors";
import {
  adminListSupportAvailability,
  type SupportSlot,
} from "@/lib/support";
import {
  formatSupportDateOnly,
  formatSupportDateTime,
  formatSupportTime,
  groupSupportSlotsByDate,
  resolveSupportTimeZone,
  supportDateWindow,
} from "@/lib/support/dates";
import { cn } from "@/lib/utils";

/**
 * Combined support-admin availability for rescheduling. Admin copy stays
 * English and all times come from the server (never browser-invented slots).
 */
export default function AdminSupportSlotPicker({
  itemId,
  professionalId,
  timeZone,
  selected,
  disabled,
  refreshKey = 0,
  onSelect,
}: {
  itemId: string;
  /** Meeting owner; sent so slots are free for the professional too. */
  professionalId?: string | null;
  timeZone: string;
  selected: SupportSlot | null;
  disabled?: boolean;
  refreshKey?: number;
  onSelect: (slot: SupportSlot | null) => void;
}) {
  const viewerTimeZone = useMemo(() => resolveSupportTimeZone(timeZone), [timeZone]);
  const [slots, setSlots] = useState<SupportSlot[]>([]);
  const [displayTimeZone, setDisplayTimeZone] = useState(viewerTimeZone);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [activeDate, setActiveDate] = useState<string | null>(null);
  const contextKey = `${itemId}:${professionalId || ""}:${viewerTimeZone}`;
  const contextRef = useRef(contextKey);

  const windowDates = useMemo(
    () => supportDateWindow(viewerTimeZone, 21),
    [viewerTimeZone],
  );

  useEffect(() => {
    if (contextRef.current === contextKey) return;
    // Meeting/owner/timezone changed: never submit a slot selected for the
    // previous context.
    contextRef.current = contextKey;
    onSelect(null);
  }, [contextKey, onSelect]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const range = supportDateWindow(viewerTimeZone, 21);
    adminListSupportAvailability({
      from: range.from,
      to: range.to,
      timeZone: viewerTimeZone,
      excludeItemId: itemId,
      professionalId: professionalId || undefined,
      signal: controller.signal,
    })
      .then((data) => {
        if (controller.signal.aborted) return;
        setDisplayTimeZone(resolveSupportTimeZone(data.timeZone || viewerTimeZone));
        setSlots(Array.isArray(data.slots) ? data.slots : []);
      })
      .catch((requestError) => {
        if (controller.signal.aborted) return;
        setSlots([]);
        setError(getErrorMessage(requestError, "Failed to load combined availability."));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [viewerTimeZone, itemId, professionalId, refreshKey, reloadKey]);

  useEffect(() => {
    if (loading || error || !selected) return;
    if (!slots.some((slot) => slot.start === selected.start)) onSelect(null);
  }, [slots, loading, error, selected, onSelect]);

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
      return firstAvailable || windowDates.dates[0] || null;
    });
  }, [grouped, windowDates.dates]);

  const visibleSlots = activeDate ? grouped.get(activeDate) || [] : [];

  return (
    <div className="space-y-2 rounded-xl border border-indigo-200 bg-indigo-50/40 p-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
          Choose a new time
        </p>
        <p className="mt-0.5 text-[11px] text-indigo-500">
          Combined availability of the meeting professional and support admins
          with write access. Times are shown in {displayTimeZone}.
        </p>
      </div>

      {loading ? (
        <p className="flex items-center justify-center gap-2 py-5 text-xs text-indigo-500">
          <Loader2 size={14} className="animate-spin" aria-hidden />
          Loading combined availability…
        </p>
      ) : error ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-rose-700">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setReloadKey((value) => value + 1)}
            className="rounded-md border border-rose-200 bg-white px-2 py-1 font-medium"
          >
            Retry
          </button>
        </div>
      ) : slots.length === 0 ? (
        <p className="rounded-lg border border-dashed border-indigo-200 bg-white/60 px-3 py-4 text-center text-xs text-indigo-500">
          No combined availability in the next three weeks.
        </p>
      ) : (
        <>
          <div
            className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
            aria-label="Available dates for rescheduling"
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
                    "flex min-h-12 min-w-[4.5rem] flex-col items-center justify-center rounded-lg border px-2 py-1 text-[11px] font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400",
                    active
                      ? "border-transparent bg-indigo-600 text-white"
                      : count > 0
                        ? "border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50"
                        : "cursor-not-allowed border-indigo-100 bg-white/50 text-indigo-300",
                  )}
                >
                  <span>{formatSupportDateOnly(date, "en-GB")}</span>
                  <span className="text-[10px] opacity-80">
                    {count > 0 ? `${count} ${count === 1 ? "time" : "times"}` : "None"}
                  </span>
                </button>
              );
            })}
          </div>

          <div
            role="radiogroup"
            aria-label="Available reschedule times"
            className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4"
          >
            {visibleSlots.map((slot) => {
              const active = selected?.start === slot.start;
              return (
                <button
                  key={slot.start}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={formatSupportDateTime(slot.start, displayTimeZone, "en-GB")}
                  onClick={() => onSelect(active ? null : slot)}
                  className={cn(
                    "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400",
                    active
                      ? "border-transparent bg-indigo-600 text-white"
                      : "border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50",
                  )}
                >
                  <CalendarClock size={13} aria-hidden />
                  {formatSupportTime(slot.start, displayTimeZone, "en-GB")}
                </button>
              );
            })}
          </div>
        </>
      )}

      <div
        tabIndex={-1}
        aria-live="polite"
        className={cn(
          "rounded-lg px-2.5 py-1.5 text-[11px]",
          selected
            ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
            : "text-indigo-400",
        )}
      >
        {selected
          ? `Selected: ${formatSupportDateTime(selected.start, displayTimeZone, "en-GB")} (${displayTimeZone})`
          : "No new time selected."}
      </div>

      {!loading && !error && slots.length > 0 && (
        <button
          type="button"
          onClick={() => setReloadKey((value) => value + 1)}
          disabled={disabled}
          className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px] font-medium text-indigo-500 hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
        >
          <RefreshCw size={11} aria-hidden />
          Refresh times
        </button>
      )}
    </div>
  );
}
