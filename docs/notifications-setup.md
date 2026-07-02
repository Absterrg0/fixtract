# Push Notifications Setup Guide

This guide covers everything needed to configure Firebase Cloud Messaging (FCM) web push for Fixera. The code is already integrated on the frontend (`fixera`) and backend (`fixera-server`) — follow the steps below to obtain credentials, set environment variables, and verify delivery.

---

## Overview

| Layer | Repo | What it does |
|-------|------|--------------|
| Frontend | `fixera` | Registers device tokens, shows in-app toasts, handles background push via service worker |
| Backend | `fixera-server` | Sends push on new chat messages and booking updates, respects per-user preferences |

Push is **disabled** until all required env vars are set. Missing frontend Firebase vars fail production builds; a missing `FCM_SERVICE_ACCOUNT_JSON` disables backend sends without crashing the API.

---

## Step 1 — Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **Add project** (or open an existing project)
3. Follow the wizard (Google Analytics for Firebase is optional — not required for push)
4. Open the project once created

---

## Step 2 — Register the Web App (Frontend Config)

You need the Firebase **web app config** — six values that become `NEXT_PUBLIC_FIREBASE_*` env vars.

1. In Firebase Console → **Project overview** (gear icon) → **Project settings**
2. Scroll to **Your apps** → click the **Web** icon (`</>`)
3. Register the app:
   - **App nickname:** e.g. `Fixera Web`
   - **Firebase Hosting:** optional (not required)
4. Click **Register app**
5. Copy the `firebaseConfig` object shown in the setup snippet:

```js
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

Map each field to an environment variable:

| Firebase field | Environment variable |
|----------------|---------------------|
| `apiKey` | `NEXT_PUBLIC_FIREBASE_API_KEY` |
| `authDomain` | `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` |
| `projectId` | `NEXT_PUBLIC_FIREBASE_PROJECT_ID` |
| `storageBucket` | `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` |
| `messagingSenderId` | `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` |
| `appId` | `NEXT_PUBLIC_FIREBASE_APP_ID` |

> You can also find these later under **Project settings → General → Your apps → SDK setup and configuration**.

---

## Step 3 — Generate the VAPID Key (Web Push)

The browser needs a **VAPID key pair** to subscribe to push.

1. Firebase Console → **Project settings** → **Cloud Messaging** tab
2. Scroll to **Web configuration** → **Web Push certificates**
3. Click **Generate key pair** (or copy an existing key pair)
4. Copy the **Key pair** value (long base64 string)

Set it as:

```env
NEXT_PUBLIC_FIREBASE_VAPID_KEY=your_vapid_key_here
```

---

## Step 4 — Create a Service Account (Backend)

The backend uses the Firebase **Admin SDK** to send pushes. You need a service account JSON key, base64-encoded for the server env.

1. Firebase Console → **Project settings** → **Service accounts** tab
2. Click **Generate new private key** → confirm **Generate key**
3. A JSON file downloads (e.g. `fixera-firebase-adminsdk-xxxxx.json`). **Store it securely — do not commit it.**

4. Base64-encode the entire JSON file for the env var:

**macOS / Linux:**

```bash
base64 -i path/to/serviceAccount.json | tr -d '\n'
```

**Linux (GNU coreutils):**

```bash
base64 -w 0 path/to/serviceAccount.json
```

5. Paste the single-line output as:

```env
FCM_SERVICE_ACCOUNT_JSON=<base64-encoded-json>
```

Set this on **`fixera-server`** only (never on the frontend).

---

## Step 5 — Set Environment Variables

### Frontend (`fixera`)

Add to `.env.local` for local dev and to your hosting provider (e.g. Vercel) for production. All are `NEXT_PUBLIC_` — embedded at **build time**; changing them requires a redeploy.

```env
# Firebase web app config (Step 2)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Web Push VAPID key (Step 3)
NEXT_PUBLIC_FIREBASE_VAPID_KEY=

# Must match the URL users visit (used by the API client)
NEXT_PUBLIC_SITE_URL=https://your-production-domain.com
NEXT_PUBLIC_BACKEND_URL=https://your-api-domain.com
```

`npm run dev` and `npm run build` run `scripts/generate-fcm-sw-config.mjs`, which writes `public/firebase-messaging-sw-config.js` from these vars. That file is **gitignored** — it is generated on each dev session and CI build.

### Backend (`fixera-server`)

```env
# Firebase Admin service account (Step 4)
FCM_SERVICE_ACCOUNT_JSON=

# Production frontend URL — no trailing slash.
# Must match the origin users register tokens from.
FRONTEND_URL=https://your-production-domain.com
```

**Origin scoping:** Tokens are stored with the site origin (`https://your-domain.com`). The backend only sends push to tokens whose origin matches `FRONTEND_URL`. Localhost (`http://localhost:3000`, `http://127.0.0.1:3000`) is always allowed for registration during development.

---

## Step 6 — Deploy

### Frontend (Vercel)

1. Open the Vercel project → **Settings → Environment Variables**
2. Add all `NEXT_PUBLIC_FIREBASE_*` vars and `NEXT_PUBLIC_FIREBASE_VAPID_KEY`
3. Ensure `NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_BACKEND_URL` point to production
4. **Redeploy** after adding or changing any `NEXT_PUBLIC_` variable

Production builds **fail** if any of the six Firebase config keys from Step 2 are missing when `VERCEL=1` or `CI=true`.

### Backend

1. Set `FCM_SERVICE_ACCOUNT_JSON` and `FRONTEND_URL` on the API host
2. Restart / redeploy the server

---

## Step 7 — Verify It Works

### Enable push in the app

1. Log in on the deployed site
2. Go to **Profile → Notifications**
3. Click **Enable push notifications** and accept the browser permission prompt
4. Confirm the UI shows push as enabled

### Confirm token registration

In DevTools → **Network**, look for:

```
POST /api/user/fcm/token
```

It should return success. The request includes the device token and is scoped to your site origin.

### Test foreground push (tab open)

1. From another account, send a chat message to the test user
2. With the recipient tab focused, an in-app toast should appear

### Test background push (tab closed or minimized)

1. Close or minimize the recipient tab (keep the browser running)
2. Send another chat message
3. A single OS notification should appear (not duplicated)
4. Clicking it should open the relevant page (e.g. chat or booking)

### Test preferences

1. On **Profile → Notifications**, disable **Messages → Push**
2. Send a chat message — no push should be delivered
3. Re-enable and confirm push resumes

### Backend log check

On server start with valid credentials you should see:

```
🔥 Firebase Admin initialised
```

If `FCM_SERVICE_ACCOUNT_JSON` is unset, push is silently skipped and a warning is logged.

---

## API Reference

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/user/fcm/token` | `POST` | Yes | Register device token |
| `/api/user/fcm/token` | `DELETE` | Yes | Unregister device token |
| `/api/user/notification-preferences` | `GET` | Yes | Read preferences |
| `/api/user/notification-preferences` | `PATCH` | Yes | Update preferences |

**Notification categories:** `booking_updates`, `messages`, `promotions`, `system` — each with `push` and `email` toggles.

**Push triggers today:** new chat messages, new professional bookings.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Production build fails on Firebase vars | Missing `NEXT_PUBLIC_FIREBASE_*` in CI/Vercel | Set all six config keys before build |
| Permission prompt never appears | Missing VAPID key or incomplete Firebase config | Set `NEXT_PUBLIC_FIREBASE_VAPID_KEY` and all config keys |
| `POST /api/user/fcm/token` returns 400 (origin) | `FRONTEND_URL` mismatch | Set `FRONTEND_URL` to exact production URL (no trailing slash) |
| Token registers but no push received | Backend `FCM_SERVICE_ACCOUNT_JSON` missing/invalid | Re-encode service account JSON; check server logs |
| Push works locally but not in production | Tokens registered under wrong origin | Re-enable push on production; tokens are origin-scoped |
| Duplicate OS notifications | Old service worker cached | Hard-refresh or clear site data; ensure latest deploy is live |
| `FCM_SERVICE_ACCOUNT_JSON is set but invalid` | Bad base64 or corrupted JSON | Re-download key from Firebase; re-encode without line breaks |

---

## Security Notes

- Never commit `firebase-messaging-sw-config.js`, `.env`, or the service account JSON file
- `FCM_SERVICE_ACCOUNT_JSON` belongs **only** on the backend
- All `NEXT_PUBLIC_FIREBASE_*` values are visible in the client bundle — this is expected for Firebase web apps; restrict API access via Firebase Console rules and App Check if needed
- Rotate the service account key if it is ever exposed

---

## Related Files

| File | Purpose |
|------|---------|
| `contexts/FCMProvider.tsx` | Token lifecycle, permission, foreground messages |
| `components/notifications/*` | Bell, preferences UI, permission prompt |
| `public/firebase-messaging-sw.js` | Background push service worker |
| `scripts/generate-fcm-sw-config.mjs` | Build-time SW config generator |
| `fixera-server/src/utils/fcmService.ts` | Admin SDK send logic |
| `fixera-server/src/handlers/User/fcmHandler.ts` | Token registration endpoints |
