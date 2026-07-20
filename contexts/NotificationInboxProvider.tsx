'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { getAuthToken } from '@/lib/utils';

export interface InboxNotification {
  id: string;
  eventKey: string;
  category: string;
  title: string;
  body: string;
  clickUrl: string;
  entityType?: string;
  entityId?: string;
  readAt: string | null;
  createdAt: string;
}

interface NotificationInboxContextValue {
  items: InboxNotification[];
  unreadCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

const NotificationInboxContext = createContext<NotificationInboxContextValue>({
  items: [],
  unreadCount: 0,
  loading: false,
  refresh: async () => {},
  markRead: async () => {},
  markAllRead: async () => {},
});

export const useNotificationInbox = () => useContext(NotificationInboxContext);

const BACKEND_URL = (process.env.NEXT_PUBLIC_BACKEND_URL ?? '').replace(/\/+$/, '');
const POLL_MS = 45_000;

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

interface ProviderProps {
  isAuthenticated: boolean;
  children: React.ReactNode;
}

export const NotificationInboxProvider: React.FC<ProviderProps> = ({
  isAuthenticated,
  children,
}) => {
  const [items, setItems] = useState<InboxNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const isAuthenticatedRef = useRef(isAuthenticated);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    isAuthenticatedRef.current = isAuthenticated;
  }, [isAuthenticated]);

  const refresh = useCallback(async () => {
    if (!isAuthenticatedRef.current || !BACKEND_URL) {
      setItems([]);
      setUnreadCount(0);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/user/notifications?limit=20`, {
        credentials: 'include',
        headers: authHeaders(),
        signal: controller.signal,
      });
      if (!res.ok) return;
      if (!isAuthenticatedRef.current || controller.signal.aborted) return;
      const json = await res.json();
      if (!isAuthenticatedRef.current || controller.signal.aborted) return;
      if (json?.success && json.data) {
        setItems(json.data.items ?? []);
        setUnreadCount(json.data.unreadCount ?? 0);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      // ignore transient network errors
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  const markRead = useCallback(async (id: string) => {
    setItems((prev) =>
      prev.map((n) => (n.id === id && !n.readAt ? { ...n, readAt: new Date().toISOString() } : n)),
    );
    setUnreadCount((c) => Math.max(0, c - 1));

    try {
      const res = await fetch(`${BACKEND_URL}/api/user/notifications/${id}/read`, {
        method: 'PATCH',
        credentials: 'include',
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error('Failed to mark notification as read');
    } catch {
      void refresh();
    }
  }, [refresh]);

  const markAllRead = useCallback(async () => {
    setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() })));
    setUnreadCount(0);

    try {
      const res = await fetch(`${BACKEND_URL}/api/user/notifications/read-all`, {
        method: 'POST',
        credentials: 'include',
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error('Failed to mark all notifications as read');
    } catch {
      void refresh();
    }
  }, [refresh]);

  useEffect(() => {
    if (!isAuthenticated) {
      abortRef.current?.abort();
      abortRef.current = null;
      setItems([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    void refresh();

    const onFocus = () => { void refresh(); };
    const onInboxRefresh = () => { void refresh(); };
    window.addEventListener('focus', onFocus);
    window.addEventListener('fixtract:inbox-refresh', onInboxRefresh);
    const interval = window.setInterval(() => { void refresh(); }, POLL_MS);

    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('fixtract:inbox-refresh', onInboxRefresh);
      window.clearInterval(interval);
      abortRef.current?.abort();
    };
  }, [isAuthenticated, refresh]);

  const value = useMemo(
    () => ({ items, unreadCount, loading, refresh, markRead, markAllRead }),
    [items, unreadCount, loading, refresh, markRead, markAllRead],
  );

  return (
    <NotificationInboxContext.Provider value={value}>
      {children}
    </NotificationInboxContext.Provider>
  );
};
