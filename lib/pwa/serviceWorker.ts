export const APP_SERVICE_WORKER_URL = "/sw.js";
export const APP_SERVICE_WORKER_SCOPE = "/";

const SW_ACTIVATION_TIMEOUT_MS = 10_000;

export function supportsServiceWorker(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator;
}

function serviceWorkerUrl(): string {
  const env = process.env.NODE_ENV ?? "production";
  return `${APP_SERVICE_WORKER_URL}?env=${env}`;
}

export async function registerAppServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!supportsServiceWorker()) return null;
  try {
    return await navigator.serviceWorker.register(serviceWorkerUrl(), {
      scope: APP_SERVICE_WORKER_SCOPE,
    });
  } catch (err) {
    console.warn("[PWA] Service worker registration failed:", err);
    return null;
  }
}

export async function waitForActiveWorker(
  reg: ServiceWorkerRegistration,
  timeoutMs = SW_ACTIVATION_TIMEOUT_MS,
): Promise<ServiceWorker | null> {
  if (reg.active) return reg.active;

  const worker = reg.installing ?? reg.waiting;
  if (!worker) return null;

  return new Promise((resolve) => {
    const onStateChange = () => {
      if (worker.state === "activated") {
        cleanup();
        resolve(reg.active);
      } else if (worker.state === "redundant") {
        cleanup();
        resolve(null);
      }
    };

    const timeoutId = setTimeout(() => {
      cleanup();
      resolve(reg.active);
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timeoutId);
      worker.removeEventListener("statechange", onStateChange);
    };

    worker.addEventListener("statechange", onStateChange);
  });
}
