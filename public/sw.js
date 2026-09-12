/* Fixtract service worker: FCM push notifications + offline asset caching. */

const CACHE_VERSION = "v1";
const PRECACHE_CACHE = `fixtract-precache-${CACHE_VERSION}`;
const STATIC_CACHE = `fixtract-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `fixtract-runtime-${CACHE_VERSION}`;
const CACHE_PREFIX = "fixtract-";
const OFFLINE_URL = "/offline.html";

/* Registration appends ?env=<NODE_ENV>; caching is disabled outside production. */
const SW_ENV =
  new URL(self.location.href).searchParams.get("env") || "production";
const OFFLINE_ENABLED = SW_ENV === "production";

const PRECACHE_URLS = [
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
];

const CACHEABLE_EXTENSIONS = [
  ".css",
  ".js",
  ".mjs",
  ".html",
  ".webmanifest",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".avif",
  ".svg",
  ".ico",
];

/* ------------------------------ FCM push ------------------------------ */

try {
  importScripts("/firebase-messaging-sw-config.js");
} catch (err) {
  console.warn("[SW] Firebase config unavailable:", err);
}

try {
  importScripts(
    "https://www.gstatic.com/firebasejs/12.15.0/firebase-app-compat.js",
  );
  importScripts(
    "https://www.gstatic.com/firebasejs/12.15.0/firebase-messaging-compat.js",
  );
} catch (err) {
  console.warn("[SW] Firebase messaging scripts unavailable:", err);
}

let messaging = null;

function initFirebase(config) {
  if (!config?.apiKey || !config?.projectId) return;
  if (typeof firebase === "undefined" || typeof firebase.messaging !== "function") {
    return;
  }
  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(config);
    }
    if (!messaging) {
      messaging = firebase.messaging();
      // Background display is handled by the notification/webpush payload from
      // the server. Do not call showNotification() here — that duplicates the
      // OS toast.
    }
  } catch (err) {
    console.error("[SW] Firebase init failed:", err);
  }
}

self.addEventListener("message", (event) => {
  if (event.data?.type === "FIREBASE_CONFIG") {
    initFirebase(event.data.config);
  }
});

if (self.__FIREBASE_CONFIG__) {
  initFirebase(self.__FIREBASE_CONFIG__);
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  // The server sends webpush.notification.data.url; messages displayed by the
  // Firebase SDK instead nest the link under data.FCM_MSG.
  const data = event.notification.data || {};
  const fcmMessage = data.FCM_MSG || {};
  const target =
    data.url ||
    fcmMessage.fcmOptions?.link ||
    fcmMessage.notification?.click_action ||
    "/";
  const url = new URL(target, self.location.origin).href;
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (client.url === url && "focus" in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) return clients.openWindow(url);
      }),
  );
});

/* --------------------------- Offline caching --------------------------- */

function isCacheableAsset(pathname) {
  const path = pathname.toLowerCase();
  return CACHEABLE_EXTENSIONS.some((ext) => path.endsWith(ext));
}

function isAppRequest(request, url) {
  if (request.method !== "GET") return false;
  if (url.origin !== self.location.origin) return false;
  // API calls (auth, chat, payments) must never be cached.
  if (url.pathname.startsWith("/api/")) return false;
  // RSC payloads are per-session and must never be served stale.
  if (url.searchParams.has("_rsc")) return false;
  if (request.headers.get("RSC") === "1") return false;
  if (request.headers.get("Next-Router-State-Tree")) return false;
  return true;
}

async function precache() {
  const cache = await caches.open(PRECACHE_CACHE);
  await Promise.all(
    PRECACHE_URLS.map(async (url) => {
      try {
        await cache.add(new Request(url, { cache: "reload" }));
      } catch (err) {
        console.warn("[SW] Precache failed:", url, err);
      }
    }),
  );
}

async function cacheFirst(event, cacheName) {
  const cache = await caches.open(cacheName);
  // Precache entries (in any fixtract cache) win, so offline requests for
  // precached assets never hit the network.
  const cached = (await cache.match(event.request)) || (await caches.match(event.request));
  if (cached) return cached;

  try {
    const response = await fetch(event.request);
    if (response.ok && response.type === "basic") {
      await cache.put(event.request, response.clone());
    }
    return response;
  } catch (err) {
    return new Response("", { status: 504, statusText: "Gateway Timeout" });
  }
}

async function staleWhileRevalidate(event, cacheName) {
  const cache = await caches.open(cacheName);
  const ownCached = await cache.match(event.request);
  const cached = ownCached || (await caches.match(event.request));

  const update = (async () => {
    try {
      const response = await fetch(event.request);
      if (response.ok && response.type === "basic") {
        await cache.put(event.request, response.clone());
      }
      return response;
    } catch (err) {
      console.warn("[SW] Revalidation failed:", event.request.url, err);
      return null;
    }
  })();

  if (cached) {
    // Precache is authoritative for its version; only revalidate runtime entries.
    if (ownCached) event.waitUntil(update);
    return cached;
  }

  const response = await update;
  if (response) return response;
  return new Response("", { status: 504, statusText: "Gateway Timeout" });
}

async function navigationHandler(event) {
  try {
    // Navigations are network-only: authenticated HTML must not be cached.
    return await fetch(event.request);
  } catch (err) {
    const cache = await caches.open(PRECACHE_CACHE);
    const offline = await cache.match(OFFLINE_URL);
    if (offline) return offline;
    return new Response("<h1>You're offline</h1>", {
      status: 503,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      if (OFFLINE_ENABLED) await precache();
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      if (OFFLINE_ENABLED) {
        const keep = new Set([PRECACHE_CACHE, STATIC_CACHE, RUNTIME_CACHE]);
        const keys = await caches.keys();
        await Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && !keep.has(key))
            .map((key) => caches.delete(key)),
        );
      }
      await self.clients.claim();
    })(),
  );
});

if (OFFLINE_ENABLED) {
  self.addEventListener("fetch", (event) => {
    let url;
    try {
      url = new URL(event.request.url);
    } catch (err) {
      return;
    }
    if (!isAppRequest(event.request, url)) return;

    if (event.request.mode === "navigate") {
      event.respondWith(navigationHandler(event));
      return;
    }

    if (url.pathname.startsWith("/_next/static/")) {
      event.respondWith(cacheFirst(event, STATIC_CACHE));
      return;
    }

    if (url.pathname.startsWith("/_next/image")) {
      event.respondWith(staleWhileRevalidate(event, STATIC_CACHE));
      return;
    }

    if (isCacheableAsset(url.pathname)) {
      event.respondWith(staleWhileRevalidate(event, RUNTIME_CACHE));
    }
  });
}
