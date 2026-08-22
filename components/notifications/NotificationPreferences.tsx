'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Bell, Mail, Smartphone, BookOpen, MessageSquare, Tag, Settings, Languages } from 'lucide-react';
import { toast } from 'sonner';
import { getAuthToken } from '@/lib/utils';
import { useFCM } from '@/contexts/FCMProvider';

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

type NotificationType = 'booking_updates' | 'messages' | 'promotions' | 'system';
type Channel = 'push' | 'email';

interface Preference {
  push: boolean;
  email: boolean;
}

interface Preferences {
  booking_updates: Preference;
  messages: Preference;
  promotions: Preference;
  system: Preference;
  marketingLocale?: string;
}

const MARKETING_LOCALES = [
  { code: 'en', label: 'English' },
  { code: 'nl', label: 'Nederlands' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
] as const;

interface MarketingLocaleOption {
  code: string;
  label: string;
}

const DEFAULT_PREFS: Preferences = {
  booking_updates: { push: true, email: true },
  messages: { push: true, email: true },
  promotions: { push: false, email: false },
  system: { push: true, email: true },
  marketingLocale: 'en',
};

const TYPE_META: { type: NotificationType; label: string; desc: string; icon: React.ReactNode }[] = [
  {
    type: 'booking_updates',
    label: 'Booking Updates',
    desc: 'New requests, confirmations, cancellations, and status changes.',
    icon: <BookOpen className="h-5 w-5 text-blue-500" />,
  },
  {
    type: 'messages',
    label: 'Messages',
    desc: 'New chat messages from customers or professionals.',
    icon: <MessageSquare className="h-5 w-5 text-purple-500" />,
  },
  {
    type: 'promotions',
    label: 'Promotional emails',
    desc: 'Loyalty rewards, special offers, and platform news. You can unsubscribe at any time.',
    icon: <Tag className="h-5 w-5 text-amber-500" />,
  },
  {
    type: 'system',
    label: 'System',
    desc: 'Account alerts, ID verification, and important notices.',
    icon: <Settings className="h-5 w-5 text-gray-500" />,
  },
];

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

const BACKEND_URL = (process.env.NEXT_PUBLIC_BACKEND_URL ?? '').replace(/\/+$/, '');

async function fetchPrefs(): Promise<Preferences | null> {
  const token = getAuthToken();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BACKEND_URL}/api/user/notification-preferences`, {
    credentials: 'include',
    headers,
  });
  if (!res.ok) return null;
  const json = await res.json();
  const data = json.data ?? {};
  return {
    booking_updates: { ...DEFAULT_PREFS.booking_updates, ...data.booking_updates },
    messages: { ...DEFAULT_PREFS.messages, ...data.messages },
    promotions: { ...DEFAULT_PREFS.promotions, ...data.promotions },
    system: { ...DEFAULT_PREFS.system, ...data.system },
    marketingLocale: typeof data.marketingLocale === 'string' ? data.marketingLocale : DEFAULT_PREFS.marketingLocale,
  };
}

async function patchPref(type: NotificationType, channel: Channel, enabled: boolean): Promise<boolean> {
  const token = getAuthToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BACKEND_URL}/api/user/notification-preferences`, {
    method: 'PATCH',
    credentials: 'include',
    headers,
    body: JSON.stringify({ type, channel, enabled }),
  });
  return res.ok;
}

async function patchMarketingLocale(marketingLocale: string): Promise<boolean> {
  const token = getAuthToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BACKEND_URL}/api/user/notification-preferences`, {
    method: 'PATCH',
    credentials: 'include',
    headers,
    body: JSON.stringify({ marketingLocale }),
  });
  return res.ok;
}

async function fetchMarketingLocales(): Promise<MarketingLocaleOption[]> {
  const res = await fetch(`${BACKEND_URL}/api/public/marketing/languages`, { credentials: 'include' });
  if (!res.ok) throw new Error('Language catalog unavailable');
  const json = await res.json();
  const source = Array.isArray(json.data?.languages) ? json.data.languages : Array.isArray(json.data) ? json.data : [];
  const catalog = source
    .map((item: unknown) => {
      if (typeof item === 'string') return { code: item, label: item.toUpperCase() };
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const code = String(record.code || record.locale || record.key || '').toLowerCase();
      return code ? { code, label: String(record.label || record.name || code.toUpperCase()) } : null;
    })
    .filter((item: MarketingLocaleOption | null): item is MarketingLocaleOption => Boolean(item));
  return catalog.length ? catalog : MARKETING_LOCALES.map(({ code, label }) => ({ code, label }));
}

// ------------------------------------------------------------------
// Toggle component
// ------------------------------------------------------------------

interface ToggleProps {
  checked: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
  id: string;
  'aria-label': string;
}

const Toggle: React.FC<ToggleProps> = ({ checked, onChange, disabled = false, id, 'aria-label': ariaLabel }) => (
  <button
    type="button"
    id={id}
    role="switch"
    aria-checked={checked}
    aria-label={ariaLabel}
    disabled={disabled}
    onClick={() => !disabled && onChange(!checked)}
    className={`
      relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full
      border-2 border-transparent transition-all duration-200 ease-in-out
      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2
      ${checked ? 'bg-blue-600' : 'bg-gray-200'}
      ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
    `}
  >
    <span
      className={`
        pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0
        transition-transform duration-200 ease-in-out
        ${checked ? 'translate-x-5' : 'translate-x-0'}
      `}
    />
  </button>
);

// ------------------------------------------------------------------
// Main panel
// ------------------------------------------------------------------

const NotificationPreferences: React.FC = () => {
  const { permissionGranted, requestPermission } = useFCM();
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [pushBlocked, setPushBlocked] = useState(false);
  const [marketingLocaleSaving, setMarketingLocaleSaving] = useState(false);
  const [marketingLocales, setMarketingLocales] = useState<MarketingLocaleOption[]>(() =>
    MARKETING_LOCALES.map(({ code, label }) => ({ code, label })),
  );

  const syncPushBlocked = useCallback(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPushBlocked(Notification.permission === 'denied');
    }
  }, []);

  useEffect(() => {
    syncPushBlocked();

    fetchPrefs()
      .then((data) => { if (data) setPrefs(data); })
      .catch(() => {})
      .finally(() => setLoading(false));

    fetchMarketingLocales()
      .then(setMarketingLocales)
      .catch(() => {});
  }, [syncPushBlocked]);

  const handleToggle = useCallback(
    async (type: NotificationType, channel: Channel, enabled: boolean) => {
      if (channel === 'push' && !permissionGranted && enabled) {
        const granted = await requestPermission();
        syncPushBlocked();
        if (!granted) return;
      }

      // Optimistic update
      setPrefs((prev) => ({
        ...prev,
        [type]: { ...prev[type], [channel]: enabled },
      }));

      const key = `${type}.${channel}`;
      setSaving(key);

      const ok = await patchPref(type, channel, enabled);

      setSaving(null);

      if (!ok) {
        // Roll back
        setPrefs((prev) => ({
          ...prev,
          [type]: { ...prev[type], [channel]: !enabled },
        }));
        toast.error('Failed to save preference. Please try again.');
      }
    },
    [permissionGranted, requestPermission, syncPushBlocked],
  );

  const handleEnablePush = useCallback(async () => {
    await requestPermission();
    syncPushBlocked();
  }, [requestPermission, syncPushBlocked]);

  const handleMarketingLocaleChange = useCallback(async (marketingLocale: string) => {
    const previous = prefs.marketingLocale || 'en';
    setPrefs((current) => ({ ...current, marketingLocale }));
    setMarketingLocaleSaving(true);
    try {
      if (await patchMarketingLocale(marketingLocale)) return;
      setPrefs((current) => ({ ...current, marketingLocale: previous }));
      toast.error('Failed to save marketing email language. Please try again.');
    } catch {
      setPrefs((current) => ({ ...current, marketingLocale: previous }));
      toast.error('Failed to save marketing email language. Please try again.');
    } finally {
      setMarketingLocaleSaving(false);
    }
  }, [prefs.marketingLocale]);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 rounded-xl bg-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-600">
          <Bell className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Notification Preferences</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Choose how and when you want to hear from us.
          </p>
        </div>
      </div>

      {/* Push blocked warning */}
      {pushBlocked && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 flex gap-3 items-start">
          <Smartphone className="h-5 w-5 shrink-0 mt-0.5 text-amber-600" />
          <div>
            <strong>Push notifications are blocked</strong> in your browser settings. To re-enable them, click the lock icon in your address bar and allow notifications for this site.
          </div>
        </div>
      )}

      {/* Permission prompt inline (if not granted and not denied) */}
      {!permissionGranted && !pushBlocked && (
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Smartphone className="h-5 w-5 text-blue-500 shrink-0" />
            <div>
              <p className="text-sm font-medium text-blue-900">Push notifications are off</p>
              <p className="text-xs text-blue-600 mt-0.5">Enable them to receive instant alerts.</p>
            </div>
          </div>
          <button
            id="enable-push-from-prefs"
            type="button"
            onClick={handleEnablePush}
            className="shrink-0 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-4 py-2 transition-colors"
          >
            Enable Push
          </button>
        </div>
      )}

      <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <Languages className="mt-0.5 h-5 w-5 text-blue-500" />
          <div className="min-w-0 flex-1">
            <label htmlFor="marketing-email-language" className="text-sm font-medium text-gray-900">
              Marketing email language
            </label>
            <p className="mt-1 text-xs text-gray-500">
              We use this language for promotional emails when it is available. Country defaults are used only when no preference is set.
            </p>
            <select
              id="marketing-email-language"
              value={prefs.marketingLocale || 'en'}
              disabled={marketingLocaleSaving}
              onChange={(event) => void handleMarketingLocaleChange(event.target.value)}
              className="mt-3 h-9 w-full max-w-xs rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
            >
              {marketingLocales.map((locale) => (
                <option key={locale.code} value={locale.code}>{locale.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Column headers */}
      <div className="hidden sm:grid grid-cols-[1fr_auto_auto] items-center gap-4 px-5">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Notification Type</span>
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider flex items-center gap-1.5 w-20 justify-center">
          <Smartphone className="h-3.5 w-3.5" /> Push
        </span>
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider flex items-center gap-1.5 w-20 justify-center">
          <Mail className="h-3.5 w-3.5" /> Email
        </span>
      </div>

      {/* Rows */}
      <div className="space-y-3">
        {TYPE_META.map(({ type, label, desc, icon }) => {
          const pref = prefs[type];
          return (
            <div
              key={type}
              className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] items-center gap-4 rounded-xl border border-gray-100 bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
            >
              {/* Info */}
              <div className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0">{icon}</div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                </div>
              </div>

              {/* Push toggle */}
              <div className="flex items-center gap-2 sm:justify-center">
                <span className="text-xs text-gray-500 sm:hidden">Push:</span>
                <Toggle
                  id={`toggle-push-${type}`}
                  aria-label={`${label} push notifications`}
                  checked={pref.push}
                  onChange={(val) => handleToggle(type, 'push', val)}
                  disabled={saving === `${type}.push` || pushBlocked}
                />
              </div>

              {/* Email toggle */}
              <div className="flex items-center gap-2 sm:justify-center">
                <span className="text-xs text-gray-500 sm:hidden">Email:</span>
                <Toggle
                  id={`toggle-email-${type}`}
                  aria-label={`${label} email notifications`}
                  checked={pref.email}
                  onChange={(val) => handleToggle(type, 'email', val)}
                  disabled={saving === `${type}.email`}
                />
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-400">
        Push notifications require browser permission. Email preferences apply to most messages.
        Critical booking, payment, dispute, and account alerts may still be sent even when a channel is turned off.
      </p>
    </div>
  );
};

export default NotificationPreferences;
