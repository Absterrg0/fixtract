"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import { useErrorMessage } from "@/lib/i18n/useErrorMessage";
import { useFormatLocale } from "@/lib/i18n/useFormatLocale";
import { replySupportItem, type SupportItem } from "@/lib/support";
import { cn } from "@/lib/utils";

export default function SupportReplySection({
  item,
  onUpdated,
  allowReply = true,
}: {
  item: SupportItem;
  onUpdated: (item: SupportItem) => void;
  allowReply?: boolean;
}) {
  const t = useTranslations("support");
  const getErrorText = useErrorMessage();
  const { intl } = useFormatLocale();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const ticketStatus = item.ticketStatus || item.status;
  const closed = ticketStatus === "closed";

  const sendReply = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const updated = await replySupportItem(item.kind, item._id || item.id, body);
      onUpdated(updated);
      setDraft("");
      toast.success(t("ticket.replySent"));
    } catch (error) {
      toast.error(getErrorText(error, t("ticket.replyFailed")));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-2">
      {item.replies.length > 0 && (
        <div className="space-y-2 border-l-2 border-indigo-100 pl-3">
          {item.replies.map((reply, index) => (
            <div
              key={reply._id || `${reply.createdAt}-${index}`}
              className="text-xs"
            >
              <span
                className={cn(
                  "font-semibold",
                  reply.authorRole === "admin" ? "text-blue-700" : "text-indigo-700",
                )}
              >
                {reply.authorRole === "admin"
                  ? t("ticket.support")
                  : t("ticket.you")}
              </span>
              <span className="text-indigo-400">
                {" · "}
                {new Intl.DateTimeFormat(intl, {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(reply.createdAt))}
              </span>
              <p className="whitespace-pre-wrap break-words text-indigo-800/90">
                {reply.body}
              </p>
            </div>
          ))}
        </div>
      )}

      {!allowReply ? null : closed ? (
        <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
          {t("ticket.closedNote")}
        </p>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label htmlFor={`reply-${item._id || item.id}`} className="sr-only">
            {t("ticket.replyAria", { subject: item.subject })}
          </label>
          <input
            id={`reply-${item._id || item.id}`}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void sendReply();
              }
            }}
            disabled={sending}
            placeholder={t("ticket.replyPlaceholder")}
            maxLength={5000}
            className="min-w-0 flex-1 rounded-xl border border-indigo-200 bg-white/70 px-3 py-2 text-sm outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-200 disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => void sendReply()}
            disabled={sending || !draft.trim()}
            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sending ? (
              <Loader2 size={13} aria-hidden className="animate-spin" />
            ) : (
              <Send size={13} aria-hidden />
            )}
            {sending ? t("ticket.sending") : t("ticket.send")}
          </button>
        </div>
      )}
    </div>
  );
}
