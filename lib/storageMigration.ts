/**
 * Phase-1 rebrand storage helpers.
 *
 * New keys are canonical. On first read of a missing new key, copy from the
 * legacy Fixera key (write-forward) so returning users keep consent / prefs
 * without requiring a data migration. Remove legacy reads after cutover.
 */

type WebStorage = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;

function storageOrNull(kind: "local" | "session"): WebStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

/** Read newKey; if missing, copy from oldKey then return that value. */
export function getMigratedItem(
  kind: "local" | "session",
  newKey: string,
  oldKey: string
): string | null {
  const store = storageOrNull(kind);
  if (!store) return null;
  try {
    const next = store.getItem(newKey);
    if (next != null) return next;

    const prev = store.getItem(oldKey);
    if (prev == null) return null;

    store.setItem(newKey, prev);
    store.removeItem(oldKey);
    return prev;
  } catch {
    return null;
  }
}

export function setMigratedItem(
  kind: "local" | "session",
  newKey: string,
  value: string,
  oldKey?: string
): void {
  const store = storageOrNull(kind);
  if (!store) return;
  try {
    store.setItem(newKey, value);
    if (oldKey) store.removeItem(oldKey);
  } catch {
    // ignore quota / private mode
  }
}

export function removeMigratedItem(
  kind: "local" | "session",
  newKey: string,
  oldKey?: string
): void {
  const store = storageOrNull(kind);
  if (!store) return;
  try {
    store.removeItem(newKey);
    if (oldKey) store.removeItem(oldKey);
  } catch {
    // ignore
  }
}

/**
 * For prefix keys (e.g. conversationSeen.*): copy any oldPrefix* entries to
 * newPrefix* once, then drop the old keys.
 */
export function migratePrefixedItems(
  kind: "local" | "session",
  newPrefix: string,
  oldPrefix: string
): void {
  const store = storageOrNull(kind);
  if (!store) return;
  try {
    const toCopy: Array<{ oldKey: string; value: string }> = [];
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (!key || !key.startsWith(oldPrefix)) continue;
      const value = store.getItem(key);
      if (value == null) continue;
      toCopy.push({ oldKey: key, value });
    }
    for (const { oldKey, value } of toCopy) {
      const suffix = oldKey.slice(oldPrefix.length);
      const newKey = newPrefix + suffix;
      if (store.getItem(newKey) == null) {
        store.setItem(newKey, value);
      }
      store.removeItem(oldKey);
    }
  } catch {
    // ignore
  }
}
