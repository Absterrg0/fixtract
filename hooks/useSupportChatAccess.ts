"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getSupportCapabilities, type SupportCapabilities } from "@/lib/support";
import {
  resolveSupportChatWriteState,
  supportChatBlockReasonFromError,
} from "@/lib/support/chatAccess";

/**
 * Effective support-chat write capability for historical support threads.
 * Fetching is deferred until a support conversation is actually selected.
 */
export function useSupportChatAccess(
  active = true,
  conversationId?: string | null,
) {
  const { user, isAuthenticated } = useAuth();
  const role = user?.role;
  const [capabilities, setCapabilities] = useState<SupportCapabilities | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [blockedReason, setBlockedReason] = useState<
    "role" | "disabled" | null
  >(null);
  const blockedReasonRef = useRef<"role" | "disabled" | null>(null);
  /** Conversation the current server 403 belongs to (stale blocks are ignored). */
  const blockedConversationRef = useRef<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const requestRef = useRef(0);

  const eligible = isAuthenticated && role === "professional";

  useEffect(() => {
    if (!active || !eligible) {
      setLoading(false);
      return;
    }
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    const controller = new AbortController();
    setLoading(true);
    setFailed(false);
    getSupportCapabilities(controller.signal)
      .then((data) => {
        if (controller.signal.aborted || requestRef.current !== requestId) return;
        setCapabilities(data);
        // A refetched capability must not erase a server 403 for the same
        // conversation: the server actively rejected the write, so keep
        // blocking until the user switches threads or explicitly retries.
        if (blockedReasonRef.current && blockedConversationRef.current === (conversationId ?? null)) {
          // keep the block
        } else if (blockedReasonRef.current) {
          blockedReasonRef.current = null;
          blockedConversationRef.current = null;
          setBlockedReason(null);
        }
      })
      .catch(() => {
        if (controller.signal.aborted || requestRef.current !== requestId) return;
        setCapabilities(null);
        setFailed(true);
      })
      .finally(() => {
        if (controller.signal.aborted || requestRef.current !== requestId) return;
        setLoading(false);
      });
    return () => controller.abort();
  }, [active, eligible, reloadKey, role, conversationId]);

  useEffect(() => {
    // A new conversation gets a fresh capability verdict; do not carry a
    // previous thread's server 403 forever.
    blockedReasonRef.current = null;
    blockedConversationRef.current = null;
    setBlockedReason(null);
  }, [role, conversationId]);

  const reload = useCallback(() => {
    blockedReasonRef.current = null;
    blockedConversationRef.current = null;
    setBlockedReason(null);
    setReloadKey((value) => value + 1);
  }, []);

  const blockFor = useCallback((error: unknown) => {
    const reason = supportChatBlockReasonFromError(error);
    if (!reason) return null;
    blockedReasonRef.current = reason;
    blockedConversationRef.current = conversationId ?? null;
    setBlockedReason(reason);
    // Re-fetch the capability; if the superadmin re-enabled chat the UI must
    // recover instead of staying disabled from the stale payload.
    setReloadKey((value) => value + 1);
    return reason;
  }, [conversationId]);

  const activeBlock = blockedConversationRef.current === (conversationId ?? null)
    ? blockedReason
    : null;
  const state = resolveSupportChatWriteState(role, capabilities, {
    loading: active && eligible && loading,
    failed: active && eligible && failed,
    blockedReason: activeBlock,
  });

  return {
    ...state,
    capabilities,
    loading: active && eligible && loading,
    reload,
    blockFor,
  };
}
