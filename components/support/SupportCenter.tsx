"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CalendarClock, LifeBuoy, Loader2, MessageCircle, RefreshCw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useErrorMessage } from "@/lib/i18n/useErrorMessage";
import { getSupportCapabilities, type SupportCapabilities } from "@/lib/support";
import {
  adminSuppliesMeetingLink,
  resolveSupportChannels,
} from "@/lib/support/channels";
import { buildSupportReasonOptions } from "@/lib/support/reasons";
import SupportTicketsPanel from "@/components/support/SupportTicketsPanel";
import SupportMeetingsPanel from "@/components/support/SupportMeetingsPanel";
import SupportChatPanel from "@/components/support/SupportChatPanel";
import { SupportErrorBanner, SupportLoading } from "@/components/support/supportUi";
import { cn } from "@/lib/utils";

export type SupportTab = "ticket" | "meeting" | "chat";

const TAB_ICONS: Record<SupportTab, React.ReactNode> = {
  ticket: <LifeBuoy size={14} aria-hidden />,
  meeting: <CalendarClock size={14} aria-hidden />,
  chat: <MessageCircle size={14} aria-hidden />,
};

const SUPPORT_TABS: SupportTab[] = ["ticket", "meeting", "chat"];

export default function SupportCenter({
  initialTab,
}: {
  initialTab?: SupportTab;
}) {
  const t = useTranslations("support");
  const getErrorText = useErrorMessage();
  const { user, isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [capabilities, setCapabilities] = useState<SupportCapabilities | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);
  const [configReload, setConfigReload] = useState(0);
  const [tab, setTab] = useState<SupportTab>(initialTab || "ticket");

  // Navigation can change ?tab= without remounting SupportCenter.
  useEffect(() => {
    setTab(initialTab || "ticket");
  }, [initialTab]);

  const eligibleRole =
    user?.role === "customer" || user?.role === "professional";

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) {
      const target =
        typeof window !== "undefined"
          ? `${window.location.pathname}${window.location.search}`
          : "/support";
      router.replace(`/login?redirect=${encodeURIComponent(target)}`);
      return;
    }
    if (user?.role === "admin") {
      router.replace("/admin/support");
      return;
    }
    if (user?.role !== "customer" && user?.role !== "professional") {
      router.replace("/dashboard");
    }
  }, [loading, isAuthenticated, user?.role, router]);

  useEffect(() => {
    if (loading || !isAuthenticated || !eligibleRole) return;
    const controller = new AbortController();
    setConfigLoading(true);
    setConfigError(null);
    getSupportCapabilities(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setCapabilities(data);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setCapabilities(null);
        setConfigError(getErrorText(error, t("config.loadFailed")));
      })
      .finally(() => {
        if (!controller.signal.aborted) setConfigLoading(false);
      });
    return () => controller.abort();
  }, [loading, isAuthenticated, eligibleRole, configReload, getErrorText, t]);

  const channels = useMemo(
    () => resolveSupportChannels(user?.role, capabilities),
    [user?.role, capabilities],
  );
  const availableTabs = useMemo(
    () =>
      SUPPORT_TABS.filter((candidate) => {
        if (candidate === "ticket") return channels.ticket;
        if (candidate === "meeting") return channels.meeting;
        return channels.chat;
      }),
    [channels],
  );  const reasonOptions = useMemo(
    () => buildSupportReasonOptions(capabilities?.reasons),
    [capabilities],
  );

  useEffect(() => {
    // Do not rewrite a deep-linked tab before auth/config resolves; the first
    // render has no role yet and would otherwise drop /support?tab=meeting.
    if (loading || !isAuthenticated || !eligibleRole || configLoading) return;
    if (!availableTabs.includes(tab)) {
      setTab(availableTabs[0] || "ticket");
    }
  }, [availableTabs, tab, loading, isAuthenticated, eligibleRole, configLoading]);

  const selectTab = (next: SupportTab) => {
    setTab(next);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.pathname = "/support";
      url.searchParams.set("tab", next);
      window.history.replaceState(null, "", `${url.pathname}${url.search}`);
    }
  };

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = availableTabs.indexOf(tab);
    if (currentIndex < 0) return;
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % availableTabs.length;
    if (event.key === "ArrowLeft") {
      nextIndex =
        (currentIndex - 1 + availableTabs.length) % availableTabs.length;
    }
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = availableTabs.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    const next = availableTabs[nextIndex];
    selectTab(next);
    document.getElementById(`support-tab-${next}`)?.focus();
  };

  if (loading || !isAuthenticated || !eligibleRole) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-gradient-to-br from-indigo-50 via-blue-50 to-white">
        <Loader2 className="animate-spin text-indigo-500" aria-hidden />
        <span className="sr-only">{t("common.loading")}</span>
      </div>
    );
  }

  const roleTitle =
    user?.role === "professional" ? t("title.professional") : t("title.customer");
  const roleSubtitle =
    user?.role === "professional" ? t("subtitle.professional") : t("subtitle.customer");

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-blue-50 to-white pb-16">
      <div className="mx-auto max-w-4xl px-4 pt-24 sm:px-6">
        <div className="rounded-3xl bg-gradient-to-br from-indigo-200 via-blue-200 to-cyan-200 p-[1.5px] shadow-md">
          <div className="rounded-[calc(1.5rem-1.5px)] bg-white px-6 py-7 sm:px-8 sm:py-8">
            <h1 className="text-2xl font-bold text-indigo-900 sm:text-3xl">
              {roleTitle}
            </h1>
            <p className="mt-1 text-sm text-indigo-600/80">{roleSubtitle}</p>
          </div>
        </div>

        {configError && (
          <SupportErrorBanner
            className="mt-4"
            message={configError}
            onRetry={() => setConfigReload((value) => value + 1)}
          />
        )}

        {configLoading && !capabilities && (
          <p className="mt-4 flex items-center gap-2 text-xs text-indigo-500">
            <RefreshCw size={12} aria-hidden className="animate-spin" />
            {t("config.loading")}
          </p>
        )}

        <div
          role="tablist"
          aria-label={t("sectionsAria")}
          onKeyDown={handleTabKeyDown}
          className="mt-6 flex flex-wrap gap-2"
        >
          {availableTabs.map((candidate) => {
            const active = candidate === tab;
            return (
              <button
                key={candidate}
                id={`support-tab-${candidate}`}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls={`support-panel-${candidate}`}
                tabIndex={active ? 0 : -1}
                onClick={() => selectTab(candidate)}
                className={cn(
                  "inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2",
                  active
                    ? "border-transparent bg-gradient-to-r from-indigo-500 to-blue-500 text-white shadow-md shadow-indigo-200"
                    : "border-indigo-200 bg-white/60 text-indigo-700 hover:bg-indigo-50",
                )}
              >
                {TAB_ICONS[candidate]}
                {candidate === "meeting" && !channels.meetingCreation
                  ? t("tabs.meetingHistory")
                  : t(`tabs.${candidate}`)}
              </button>
            );
          })}
        </div>

        {availableTabs.length === 0 ? (
          <SupportLoading label={t("config.noChannels")} />
        ) : (
          <>
            {tab === "ticket" && channels.ticket && (
              <div
                role="tabpanel"
                id="support-panel-ticket"
                aria-labelledby="support-tab-ticket"
                className="mt-6"
              >
                <SupportTicketsPanel reasonOptions={reasonOptions} />
              </div>
            )}
            {tab === "meeting" && channels.meeting && (
              <div
                role="tabpanel"
                id="support-panel-meeting"
                aria-labelledby="support-tab-meeting"
                className="mt-6"
              >
                <SupportMeetingsPanel
                  reasonOptions={reasonOptions}
                  canCreate={channels.meetingCreation}
                  adminSuppliesLink={adminSuppliesMeetingLink(capabilities)}
                />
              </div>
            )}
            {tab === "chat" && channels.chat && (
              <div
                role="tabpanel"
                id="support-panel-chat"
                aria-labelledby="support-tab-chat"
                className="mt-6"
              >
                <SupportChatPanel
                  canWrite={channels.chat}
                  onWriteBlocked={() => setConfigReload((value) => value + 1)}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
