type CacheEntry<T> = {
  expiresAt: number;
  value?: T;
  promise?: Promise<T>;
};

const entries = new Map<string, CacheEntry<unknown>>();

export async function cachedClientRequest<T>(
  key: string,
  loader: () => Promise<T>,
  ttlMs: number,
): Promise<T> {
  const now = Date.now();
  const existing = entries.get(key) as CacheEntry<T> | undefined;

  if (existing?.value !== undefined && existing.expiresAt > now) {
    return existing.value;
  }
  if (existing?.promise) {
    return existing.promise;
  }

  const entry: CacheEntry<T> = { expiresAt: now + ttlMs };
  entry.promise = loader()
    .then((value) => {
      entry.value = value;
      entry.expiresAt = Date.now() + ttlMs;
      entry.promise = undefined;
      if (ttlMs <= 0 && entries.get(key) === entry) {
        entries.delete(key);
      }
      return value;
    })
    .catch((error) => {
      if (entries.get(key) === entry) {
        entries.delete(key);
      }
      throw error;
    });
  entries.set(key, entry);
  return entry.promise;
}

export function invalidateClientRequest(key: string): void {
  entries.delete(key);
}

export function invalidateClientRequestsByPrefix(prefix: string): void {
  for (const key of entries.keys()) {
    if (key.startsWith(prefix)) {
      entries.delete(key);
    }
  }
}
