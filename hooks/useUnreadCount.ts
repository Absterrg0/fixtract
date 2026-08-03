import { useCallback, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useChatPolling } from "@/hooks/useChatPolling";
import { fetchUnreadConversationCount } from "@/lib/chatApi";

const isAllowedRole = (role?: string) => role === "customer" || role === "professional";

export const useUnreadCount = () => {
  const { user, isAuthenticated } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const userRole = user?.role;
  const enabled = isAuthenticated && isAllowedRole(userRole);

  const poll = useCallback(async () => {
    try {
      setUnreadCount(await fetchUnreadConversationCount());
    } catch {
      // silently ignore polling errors
    }
  }, []);

  useChatPolling(poll, 30000, enabled, [userRole]);

  return { unreadCount, enabled };
};
