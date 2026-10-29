"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { LifeBuoy, Loader2, MessageCircle, Send } from "lucide-react";
import { useErrorMessage } from "@/lib/i18n/useErrorMessage";
import { useFormatLocale } from "@/lib/i18n/useFormatLocale";
import {
  fetchConversationMessages,
  fetchConversations,
  markConversationAsRead,
  sendConversationMessage,
} from "@/lib/chatApi";
import type { ChatConversation, ChatMessage } from "@/types/chat";
import { supportChatBlockReasonFromError } from "@/lib/support/chatAccess";
import {
  SupportCard,
  SupportErrorBanner,
  SupportLoading,
} from "@/components/support/supportUi";
import { cn } from "@/lib/utils";

const SUPPORT_POLL_MS = 6000;

export default function SupportChatPanel({
  canWrite = true,
  onWriteBlocked,
}: {
  canWrite?: boolean;
  onWriteBlocked?: () => void;
}) {
  const t = useTranslations("support");
  const getErrorText = useErrorMessage();
  const { intl } = useFormatLocale();
  const [writeBlocked, setWriteBlocked] = useState(false);
  const [conversation, setConversation] = useState<ChatConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const shouldStickToBottom = useRef(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const scrollToBottom = useCallback(() => {
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, []);

  const findSupportConversation = useCallback(async (): Promise<ChatConversation | null> => {
    // Walk every page: an older support thread can sit beyond the first page.
    const support: ChatConversation[] = [];
    for (let page = 1; ; page += 1) {
      const data = await fetchConversations({ page, limit: 100 });
      support.push(...data.conversations.filter((item) => item.type === "support"));
      const totalPages = data.pagination?.totalPages ?? 1;
      if (page >= totalPages) break;
    }
    if (support.length === 0) return null;
    support.sort((a, b) => {
      const at = new Date(a.lastMessageAt || a.updatedAt || a.createdAt).getTime();
      const bt = new Date(b.lastMessageAt || b.updatedAt || b.createdAt).getTime();
      return bt - at;
    });
    return support[0];
  }, []);

  /** Guards overlapping loads/polls: only the newest response may apply. */
  const loadSeqRef = useRef(0);
  const loadMessages = useCallback(async (conversationId: string) => {
    const seq = ++loadSeqRef.current;
    const data = await fetchConversationMessages(conversationId, { limit: 100 });
    if (!mountedRef.current || seq !== loadSeqRef.current) return;
    setMessages(data.messages);
    setConversation(data.conversation);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setConversation(null);
    setMessages([]);
    conversationIdRef.current = null;

    const init = async () => {
      try {
        const found = await findSupportConversation();
        if (cancelled) return;
        if (!found) {
          setLoading(false);
          return;
        }
        conversationIdRef.current = found._id;
        setConversation(found);
        await loadMessages(found._id);
        if (cancelled) return;
        markConversationAsRead(found._id).catch(() => {});
      } catch (error) {
        if (cancelled) return;
        setLoadError(getErrorText(error, t("chat.loadFailed")));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void init();

    const interval = setInterval(async () => {
      if (cancelled) return;
      const id = conversationIdRef.current;
      try {
        if (id) {
          await loadMessages(id);
          markConversationAsRead(id).catch(() => {});
        } else {
          const found = await findSupportConversation();
          if (cancelled || !found) return;
          conversationIdRef.current = found._id;
          setConversation(found);
          await loadMessages(found._id);
          setLoadError(null);
        }
      } catch {
        // Transient polling errors are ignored; the visible state stays intact.
      }
    }, SUPPORT_POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [findSupportConversation, loadMessages, getErrorText, t, reloadKey]);

  useEffect(() => {
    if (shouldStickToBottom.current) scrollToBottom();
  }, [messages, loading, scrollToBottom]);

  const handleScroll = () => {
    const element = scrollRef.current;
    if (!element) return;
    const distanceFromBottom =
      element.scrollHeight - element.scrollTop - element.clientHeight;
    shouldStickToBottom.current = distanceFromBottom < 80;
  };

  const send = async () => {
    const id = conversationIdRef.current;
    const text = draft.trim();
    if (!id || !text || sending || !canWrite || writeBlocked) return;
    setSending(true);
    try {
      shouldStickToBottom.current = true;
      await sendConversationMessage(id, { text });
      setDraft("");
      await loadMessages(id);
    } catch (error) {
      if (supportChatBlockReasonFromError(error)) {
        setWriteBlocked(true);
        setDraft("");
        onWriteBlocked?.();
        toast.error(t("chat.readOnlyBlocked"));
      } else {
        toast.error(getErrorText(error, t("chat.sendFailed")));
      }
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <SupportCard>
        <SupportLoading label={t("common.loading")} />
      </SupportCard>
    );
  }

  if (loadError) {
    return (
      <SupportErrorBanner
        message={loadError}
        onRetry={() => setReloadKey((value) => value + 1)}
      />
    );
  }

  if (!conversation) {
    return (
      <SupportCard>
        <div className="p-10 text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-indigo-400 to-blue-500 text-white shadow-md shadow-indigo-200">
            <MessageCircle size={24} aria-hidden />
          </div>
          <h2 className="text-lg font-semibold text-indigo-900">
            {t("chat.emptyTitle")}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-indigo-600/80">
            {t("chat.emptyBody")}
          </p>
        </div>
      </SupportCard>
    );
  }

  return (
    <SupportCard>
      <div className="flex h-[28rem] flex-col">
        <div className="flex items-center gap-2 border-b border-indigo-100 px-5 py-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-400 to-blue-500 text-white shadow-sm">
            <LifeBuoy size={16} aria-hidden />
          </div>
          <div>
            <p className="text-sm font-semibold text-indigo-900">
              {t("chat.teamName")}
            </p>
            <p className="text-[11px] text-indigo-500">{t("chat.teamSubtitle")}</p>
          </div>
        </div>

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 space-y-3 overflow-y-auto px-5 py-4"
        >
          {messages.length === 0 ? (
            <div className="flex h-full items-center justify-center text-center text-sm text-indigo-400">
              {t("chat.noMessages")}
            </div>
          ) : (
            messages.map((message) => {
              const fromAdmin =
                message.senderRole === "admin" || message.senderRole === "system";
              return (
                <div
                  key={message._id}
                  className={cn("flex", fromAdmin ? "justify-start" : "justify-end")}
                >
                  <div
                    className={cn(
                      "max-w-[78%] rounded-2xl px-4 py-2 text-sm shadow-sm",
                      fromAdmin
                        ? "rounded-tl-sm bg-indigo-50 text-indigo-900"
                        : "rounded-tr-sm bg-gradient-to-r from-indigo-500 to-blue-500 text-white",
                    )}
                  >
                    <div
                      className={cn(
                        "mb-0.5 text-[10px] font-semibold uppercase tracking-wide",
                        fromAdmin ? "text-indigo-500" : "text-indigo-100",
                      )}
                    >
                      {fromAdmin ? t("chat.support") : t("chat.you")}
                    </div>
                    {message.text && (
                      <p className="whitespace-pre-wrap break-words">{message.text}</p>
                    )}
                    {Array.isArray(message.images) && message.images.length > 0 && (
                      <div className="mt-1 space-y-1">
                        {message.images.map((src, index) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            key={`${src}-${index}`}
                            src={src}
                            alt={t("chat.attachmentAlt")}
                            className="max-h-48 rounded-lg"
                          />
                        ))}
                      </div>
                    )}
                    <div
                      className={cn(
                        "mt-1 text-[10px]",
                        fromAdmin ? "text-indigo-400" : "text-indigo-100/80",
                      )}
                    >
                      {new Date(message.createdAt).toLocaleString(intl)}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {!canWrite || writeBlocked ? (
          <div className="border-t border-indigo-100 bg-indigo-50/70 px-4 py-3 text-center text-xs text-indigo-700">
            <p>{!canWrite ? t("chat.readOnlyDisabled") : t("chat.readOnlyBlocked")}</p>
            {writeBlocked ? (
              <button
                type="button"
                onClick={() => {
                  setWriteBlocked(false);
                  onWriteBlocked?.();
                }}
                className="mt-1.5 inline-flex min-h-8 items-center rounded-lg border border-indigo-300 bg-white px-3 py-1 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
              >
                {t("chat.recheck")}
              </button>
            ) : null}
          </div>
        ) : (
          <div className="flex items-center gap-2 border-t border-indigo-100 px-4 py-3">
            <label htmlFor="support-chat-input" className="sr-only">
              {t("chat.inputAria")}
            </label>
            <input
              id="support-chat-input"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void send();
                }
              }}
              disabled={sending}
              placeholder={t("chat.placeholder")}
              maxLength={2000}
              className="min-w-0 flex-1 rounded-xl border border-indigo-200 bg-white/60 px-4 py-2 text-sm outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-200 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => void send()}
              aria-label={t("chat.send")}
              disabled={sending || !draft.trim()}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-indigo-200 transition hover:shadow-lg hover:shadow-indigo-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sending ? (
                <Loader2 size={14} aria-hidden className="animate-spin" />
              ) : (
                <Send size={14} aria-hidden />
              )}
              <span className="hidden sm:inline">{t("chat.send")}</span>
            </button>
          </div>
        )}
      </div>
    </SupportCard>
  );
}
