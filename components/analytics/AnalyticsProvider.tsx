'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { CONSENT_EVENT, getConsent } from '@/lib/consent';
import { getPageType, getTrafficAttribution, trackPageView, type GtagCommand } from '@/lib/analytics';

const gaMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim();
const clarityProjectId = process.env.NEXT_PUBLIC_MS_CLARITY_PROJECT_ID?.trim();

export default function AnalyticsProvider() {
  const pathname = usePathname();
  const [analyticsConsented, setAnalyticsConsented] = useState(false);

  // Effect 1: subscribe to consent changes (DOM lifecycle only)
  useEffect(() => {
    const readConsent = () => setAnalyticsConsented(getConsent()?.analytics === true);
    readConsent();
    window.addEventListener(CONSENT_EVENT, readConsent);
    return () => window.removeEventListener(CONSENT_EVENT, readConsent);
  }, []);

  // Effect 2: install scripts + track page on consent grant or route change
  useEffect(() => {
    if (!analyticsConsented) return;

    installGoogleAnalytics();
    installClarity();

    const search = window.location.search.replace(/^\?/, '');
    trackPageView(pathname, search);

    if (window.clarity) {
      window.clarity('set', 'page_type', getPageType(pathname));
      window.clarity('set', 'traffic_bucket', getTrafficAttribution().traffic_bucket || 'unknown');
    }
  }, [analyticsConsented, pathname]);

  return null;
}

function installGoogleAnalytics(): void {
  if (!gaMeasurementId || typeof window === 'undefined') return;

  window.dataLayer = window.dataLayer || [];
  window.gtag =
    window.gtag ||
    function gtag(command: GtagCommand, target: string | Date, params?: Record<string, unknown>) {
      window.dataLayer?.push([command, target, params]);
    };

  if (!document.getElementById('fixera-ga4-script')) {
    const script = document.createElement('script');
    script.id = 'fixera-ga4-script';
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaMeasurementId)}`;
    document.head.appendChild(script);

    const gtag = window.gtag;
    gtag('js', new Date());
    gtag('config', gaMeasurementId, {
      send_page_view: false,
      anonymize_ip: true,
    });
  }
}

function installClarity(): void {
  if (!clarityProjectId || typeof window === 'undefined') return;

  window.clarity =
    window.clarity ||
    function clarity(...args: unknown[]) {
      (window.clarity!.q = window.clarity!.q || []).push(args);
    };

  if (document.getElementById('fixera-clarity-script')) return;

  const script = document.createElement('script');
  script.id = 'fixera-clarity-script';
  script.async = true;
  script.src = `https://www.clarity.ms/tag/${encodeURIComponent(clarityProjectId)}`;
  document.head.appendChild(script);
}
