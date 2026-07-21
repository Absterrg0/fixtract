'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck, Settings } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useNotificationInbox } from '@/contexts/NotificationInboxProvider';

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffSec = Math.round((Date.now() - then) / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(iso).toLocaleDateString();
}

interface NotificationBellProps {
  className?: string;
}

/**
 * Notification bell with dropdown inbox of received notifications.
 */
const NotificationBell: React.FC<NotificationBellProps> = ({ className = '' }) => {
  const router = useRouter();
  const { items, unreadCount, loading, markRead, markAllRead, refresh } = useNotificationInbox();

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) void refresh();
      }}
    >
      <DropdownMenuTrigger asChild>
        <button
          id="notification-bell"
          type="button"
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
          className={`relative inline-flex items-center justify-center h-8 w-8 rounded-full text-gray-600 hover:text-blue-600 hover:bg-gray-100 transition-colors ${className}`}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span
              aria-hidden="true"
              className="absolute -top-0.5 -right-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-80 sm:w-96 p-0" align="end" forceMount>
        <div className="flex items-center justify-between gap-2 px-3 py-2.5">
          <DropdownMenuLabel className="p-0 text-sm font-semibold">Notifications</DropdownMenuLabel>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => { void markAllRead(); }}
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </button>
            )}
            <Link
              href="/profile?tab=notifications"
              aria-label="Notification settings"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <Settings className="h-4 w-4" />
            </Link>
          </div>
        </div>
        <DropdownMenuSeparator className="my-0" />

        <div className="max-h-80 overflow-y-auto">
          {loading && items.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-gray-400">Loading…</p>
          )}
          {!loading && items.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-gray-400">No notifications yet</p>
          )}
          {items.map((n) => {
            const unread = !n.readAt;
            return (
              <DropdownMenuItem
                key={n.id}
                className={`flex flex-col items-start gap-0.5 px-3 py-2.5 cursor-pointer rounded-none focus:bg-gray-50 ${
                  unread ? 'bg-blue-50/60' : ''
                }`}
                onSelect={(e) => {
                  e.preventDefault();
                  if (unread) void markRead(n.id);
                  if (n.clickUrl) {
                    try {
                      const url = new URL(n.clickUrl, window.location.origin);
                      if (url.origin === window.location.origin) {
                        router.push(`${url.pathname}${url.search}${url.hash}`);
                      } else {
                        window.location.href = n.clickUrl;
                      }
                    } catch {
                      router.push(n.clickUrl);
                    }
                  }
                }}
              >
                <div className="flex w-full items-start justify-between gap-2">
                  <p className={`text-sm leading-snug ${unread ? 'font-semibold text-gray-900' : 'font-medium text-gray-800'}`}>
                    {n.title}
                  </p>
                  <span className="shrink-0 text-[10px] text-gray-400 mt-0.5">
                    {relativeTime(n.createdAt)}
                  </span>
                </div>
                <p className="text-xs text-gray-500 line-clamp-2 w-full">{n.body}</p>
              </DropdownMenuItem>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default NotificationBell;
