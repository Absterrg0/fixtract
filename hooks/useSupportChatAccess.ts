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
        // A stale capability must not permanently disable writes. A server
        // role restriction (wrong support target) still holds until the user
        // switches conversation or explicitly re-checks.
        if (blockedReasonRef.current !== "role") {
          blockedReasonRef.current = null;
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
    setBlockedReason(null);
  }, [role, conversationId]);

  const reload = useCallback(() => {
    blockedReasonRef.current = null;
    setBlockedReason(null);
    setReloadKey((value) => value + 1);
  }, []);

  const blockFor = useCallback((error: unknown) => {
    const reason = supportChatBlockReasonFromError(error);
    if (!reason) return null;
    blockedReasonRef.current = reason;
    setBlockedReason(reason);
    // Re-fetch the capability; if the superadmin re-enabled chat the UI must
    // recover instead of staying disabled from the stale payload.
    setReloadKey((value) => value + 1);
    return reason;
  }, []);

  const state = resolveSupportChatWriteState(role, capabilities, {
    loading: active && eligible && loading,
    failed: active && eligible && failed,
    blockedReason,
  });

  return {
    ...state,
    capabilities,
    loading: active && eligible && loading,
    reload,
    blockFor,
  };
}
