# Analytics Setup Guide

This guide covers everything needed to configure **Google Analytics 4 (GA4)** and **Microsoft Clarity** for Fixera. The code is already integrated — follow the steps below to obtain your measurement IDs, set environment variables, and configure the dashboards.

> **Note:** Fixera uses **Microsoft Clarity** for session recordings and heatmaps — not Sanity CMS. If you were looking for a headless CMS, that is a separate integration and is not part of this analytics feature.

---

## Quick Reference — Tokens / IDs You Need

| Service | What to get | Environment variable | Format |
|---------|-------------|---------------------|--------|
| Google Analytics 4 | Measurement ID | `NEXT_PUBLIC_GA_MEASUREMENT_ID` | `G-XXXXXXXXXX` |
| Microsoft Clarity | Project ID | `NEXT_PUBLIC_MS_CLARITY_PROJECT_ID` | Short alphanumeric string |

Both variables are **frontend-only** (`fixera` repo). Set them in `.env.local` for local dev and in Vercel (or your host) for production.

```env
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
NEXT_PUBLIC_MS_CLARITY_PROJECT_ID=your_clarity_project_id
```

> **Important:** Both are `NEXT_PUBLIC_` variables — embedded into the client bundle at **build time**. Set them in your hosting environment **before** building and deploying. Changes require a redeploy.

Scripts load **only after the visitor grants analytics consent** via the cookie banner. Without consent, neither GA4 nor Clarity initialises.

---

## Part 1 — Google Analytics 4

### Step 1: Get the GA4 Measurement ID

1. Go to [analytics.google.com](https://analytics.google.com)
2. Click **Admin** (gear icon, bottom-left)
3. Under **Account** → **Create Account** (or select an existing account)
4. Under **Property** → **Create Property**
5. Enter a property name (e.g. `Fixera Production`), timezone, and currency → **Next**
6. Fill in business details → **Create**
7. Choose **Web** as the platform
8. Enter your site URL and a stream name (e.g. `Fixera Web`) → **Create stream**
9. On the stream details page, copy the **Measurement ID** (format: `G-XXXXXXXXXX`)

Set it as:

```env
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

---

### Step 2: Mark Key Events

GA4 key events are the business actions Fixera tracks. Mark these in the dashboard so they appear in conversion reports.

1. GA4 → **Admin** → **Data display** → **Events**
2. Click **+ New key event**
3. Add each event name:

| Event name | What it tracks |
|------------|----------------|
| `purchase` | Revenue event — fires on payment success |
| `complete_booking` | Booking confirmed (payment success page) |
| `begin_checkout` | Payment intent created / user reaches payment page |
| `complete_rfq` | RFQ form submitted successfully |
| `begin_rfq` | RFQ package selected |
| `generate_lead` | RFQ submitted or professional contacted via chat |
| `view_item` | Project detail page viewed |
| `project_search` | Search performed with type = projects |

> You can type event names directly — you do not need to wait for them to appear in the list first.

---

### Step 3: Create Custom Dimensions

1. **Admin** → **Data display** → **Custom definitions** → **Create custom dimension**
2. Create all of the following — all are **Event scoped**:

| Dimension name | Event parameter | Description |
|----------------|-----------------|-------------|
| Page Type | `page_type` | Page category (`landing_page`, `project_detail`, `search`, etc.) |
| Traffic Bucket | `traffic_bucket` | Classified traffic channel |
| Project Category | `project_category` | Category of the project viewed or booked |
| Project Service | `project_service` | Service type of the project |
| Search Type | `search_type` | `projects` or `professionals` |
| Results Count | `results_count` | Number of search results |
| Filters Count | `filters_count` | Active filters on a search |
| Booking ID | `booking_id` | Internal booking identifier |

**`page_type` values:** `landing_page`, `blog`, `news`, `service_landing`, `project_detail`, `search`, `professional_profile`, `content_page`, `auth`, `app`, `admin`, `other`

**`traffic_bucket` values:** `direct`, `google_organic`, `google_ads`, `facebook`, `facebook_ads`, `instagram`, `instagram_ads`, `email_campaign`, `ai`, `organic_other`, `referral_other`

---

### Step 4: Build Reports (Explorations)

Go to **Explore** → **Blank** for each report.

#### Traffic Acquisition

- **Dimensions:** Session source / medium, Traffic Bucket (custom)
- **Metrics:** Users, New users, Sessions, Engagement rate, Session key event rate, Total revenue
- **Filter:** Country

#### Pages Engagement

- **Dimensions:** Page path + query string, Page Type (custom)
- **Metrics:** Users, Sessions, Average engagement time, Engagement rate, Session key event rate, Total revenue

#### Purchase Funnel

1. **Explore** → **Funnel exploration**
2. Add steps:

| Step | Event |
|------|-------|
| 1 | `session_start` |
| 2 | `project_search` |
| 3 | `view_item` |
| 4 | `begin_rfq` or `begin_checkout` |
| 5 | `complete_rfq` or `begin_checkout` |
| 6 | `begin_checkout` |
| 7 | `complete_booking` |

3. **Breakdown** → Device category
4. Add **Country** as a filter

---

### Step 5: Verify GA4

1. Open the deployed site in Chrome
2. Accept the cookie/analytics consent banner
3. DevTools → **Network** → filter `collect`
4. Navigate and search — requests to `www.google-analytics.com/g/collect` should return `204`
5. GA4 → **Reports → Realtime** — active users should appear immediately

Standard reports populate within 24–48 hours.

---

## Part 2 — Microsoft Clarity

### Step 1: Get the Clarity Project ID

1. Go to [clarity.microsoft.com](https://clarity.microsoft.com)
2. Sign in with a Microsoft account
3. Click **New project**
4. Enter your site name and URL → **Create**
5. On the setup screen, copy the **Project ID** (short alphanumeric string, e.g. `abc12de3fg`)

Set it as:

```env
NEXT_PUBLIC_MS_CLARITY_PROJECT_ID=abc12de3fg
```

> Clarity may show a tracking script snippet during setup — **you do not need to paste it**. Fixera loads Clarity via `AnalyticsProvider` after consent.

---

### Step 2: Link Clarity to GA4

Connects Clarity recordings to GA4 segments (e.g. users who completed a booking).

1. Clarity → your project → **Settings** (gear icon)
2. **Setup** tab → **Google Analytics**
3. **Connect to Google Analytics**
4. Sign in with the Google account that owns the GA4 property
5. Select the GA4 property from Part 1 → **Save**

---

### Step 3: Verify Clarity

1. Open the deployed site in Chrome
2. Accept the analytics consent banner
3. DevTools → **Network** → filter `clarity`
4. Requests to `https://www.clarity.ms/collect` should appear

Recordings show up within minutes. Heatmaps accumulate over time.

---

## Deployment Checklist

### Local development (`fixera`)

1. Copy `.env.example` to `.env.local`
2. Set both analytics variables
3. Run `npm run dev`
4. Accept the cookie banner on `http://localhost:3000`
5. Confirm network requests to GA and Clarity

### Production (Vercel)

1. **Settings → Environment Variables**
2. Add `NEXT_PUBLIC_GA_MEASUREMENT_ID` and `NEXT_PUBLIC_MS_CLARITY_PROJECT_ID` for Production (and Preview if desired)
3. **Redeploy** — env changes do not apply to existing builds

---

## Clarity Custom Events and Tags

Fixera sends Clarity custom events matching GA4 event names (`clarity('event', eventName)`). Filter recordings by funnel steps:

- `project_search` — how users searched
- `begin_checkout` without `complete_booking` — drop-off behaviour

Per-page Clarity tags (available under **Filters** in recordings):

| Tag | Values |
|-----|--------|
| `page_type` | Same as GA4 `page_type` dimension |
| `traffic_bucket` | Same as GA4 `traffic_bucket` dimension |

---

## Events Reference

All events sent to GA4 and Clarity:

| Event | Trigger | GA4 ecommerce? |
|-------|---------|----------------|
| `page_view` | Every pathname change (after consent) | No |
| `search` | Every successful search | No |
| `project_search` | Search with type = projects | No |
| `view_item` | Project detail page loaded | Yes (`items[]`) |
| `begin_booking` | Fixed/unit package selected | No |
| `begin_rfq` | RFQ package selected | Yes (`items[]`) |
| `complete_rfq` | RFQ submitted | Yes (`items[]`) |
| `generate_lead` | RFQ submitted or professional contacted | No |
| `contact_professional` | Chat opened from project page | No |
| `begin_checkout` | Payment page reached | Yes (`items[]`) |
| `payment_authorized` | Stripe authorization confirmed | No |
| `booking_request_submitted` | Non-RFQ booking request submitted | No |
| `complete_booking` | Payment success page | Yes (`items[]`) |
| `purchase` | Payment success (revenue) | Yes (`items[]`, `value`, `transaction_id`) |

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| No GA/Clarity requests in Network | Consent not granted | Accept analytics in the cookie banner |
| GA works locally but not production | Env vars missing at build time | Set vars in Vercel, then redeploy |
| Realtime shows 0 users | Wrong Measurement ID or ad blocker | Verify `G-XXXXXXXXXX`; test in incognito without extensions |
| Clarity shows no recordings | Missing Project ID or consent blocked | Verify `NEXT_PUBLIC_MS_CLARITY_PROJECT_ID`; redeploy |
| Events missing custom dimensions | Dimensions not created in GA4 | Complete Step 3 above; allow 24h for data |

---

## Related Files

| File | Purpose |
|------|---------|
| `components/analytics/AnalyticsProvider.tsx` | Loads GA4 and Clarity after consent |
| `lib/analytics.ts` | Event helpers (`trackPageView`, `trackEvent`, ecommerce) |
| `lib/consent.ts` | Cookie consent state |
| `components/cookie-consent/CookieConsent.tsx` | Consent banner UI |
