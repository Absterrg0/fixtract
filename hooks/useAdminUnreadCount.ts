import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useChatPolling } from "@/hooks/useChatPolling";
import { authFetch } from "@/lib/utils";
import {
  getMigratedItem,
  migratePrefixedItems,
  setMigratedItem,
} from "@/lib/storageMigration";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL;

export const ADMIN_ACTIVE_CONVERSATION_KEY = "fixtract.admin.activeConversationId";
export const ADMIN_CONVERSATION_SEEN_PREFIX = "fixtract.admin.conversationSeen.";
const LEGACY_ADMIN_ACTIVE_CONVERSATION_KEY = "fixera.admin.activeConversationId";
const LEGACY_ADMIN_CONVERSATION_SEEN_PREFIX = "fixera.admin.conversationSeen.";

let adminSeenPrefixMigrated = false;

function ensureAdminSeenPrefixMigrated() {
  if (adminSeenPrefixMigrated) return;
  adminSeenPrefixMigrated = true;
  migratePrefixedItems(
    "local",
    ADMIN_CONVERSATION_SEEN_PREFIX,
    LEGACY_ADMIN_CONVERSATION_SEEN_PREFIX
  );
}

export const getAdminActiveConversationId = (): string => {
  if (typeof window === "undefined") return "";
  try {
    return (
      getMigratedItem(
        "local",
        ADMIN_ACTIVE_CONVERSATION_KEY,
        LEGACY_ADMIN_ACTIVE_CONVERSATION_KEY
      ) || ""
    );
  } catch {
    return "";
  }
};

export const setAdminActiveConversationId = (conversationId: string) => {
  if (typeof window === "undefined") return;
  try {
    if (conversationId) {
      setMigratedItem(
        "local",
        ADMIN_ACTIVE_CONVERSATION_KEY,
        conversationId,
        LEGACY_ADMIN_ACTIVE_CONVERSATION_KEY
      );
    }
  } catch {
    // ignore storage errors
  }
};

export const getAdminConversationSeenAt = (conversationId: string): number => {
  if (typeof window === "undefined" || !conversationId) return 0;
  try {
    ensureAdminSeenPrefixMigrated();
    const raw = window.localStorage.getItem(
      ADMIN_CONVERSATION_SEEN_PREFIX + conversationId
    );
    const parsed = raw ? Number(raw) : 0;
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
};

export const markAdminConversationSeen = (
  conversationId: string,
  seenAt: number = Date.now()
) => {
  if (typeof window === "undefined" || !conversationId) return;
  try {
    ensureAdminSeenPrefixMigrated();
    window.localStorage.setItem(
      ADMIN_CONVERSATION_SEEN_PREFIX + conversationId,
      String(seenAt)
    );
    window.localStorage.removeItem(
      LEGACY_ADMIN_CONVERSATION_SEEN_PREFIX + conversationId
    );
    window.dispatchEvent(new CustomEvent("fixtract:admin-chat-seen"));
  } catch {
    // ignore storage errors
  }
};

export const useAdminUnreadCount = () => {
  const { user, isAuthenticated } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const enabled = isAuthenticated && user?.role === "admin";
  const consecutiveFailuresRef = useRef(0);
  const cooldownUntilRef = useRef(0);

  const poll = useCallback(async () => {
    if (!BACKEND) {
      setUnreadCount(0);
      return;
    }
    if (Date.now() < cooldownUntilRef.current) return;
    try {
      const res = await authFetch(`${BACKEND}/api/admin/conversations/unread-count`);
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error("unread-count request failed");
      }
      const count = Number(json.data?.count);
      setUnreadCount(Number.isFinite(count) && count > 0 ? count : 0);
      consecutiveFailuresRef.current = 0;
      cooldownUntilRef.current = 0;
    } catch {
      consecutiveFailuresRef.current += 1;
      if (consecutiveFailuresRef.current >= 3) {
        cooldownUntilRef.current = Date.now() + 60_000;
        setUnreadCount(0);
      }
    }
  }, []);

  useChatPolling(poll, 15000, enabled, []);

  useEffect(() => {
    if (!enabled) return;
    const onSeen = () => void poll();
    window.addEventListener("fixtract:admin-chat-seen", onSeen);
    return () => window.removeEventListener("fixtract:admin-chat-seen", onSeen);
  }, [enabled, poll]);

  return { unreadCount, enabled };
};
