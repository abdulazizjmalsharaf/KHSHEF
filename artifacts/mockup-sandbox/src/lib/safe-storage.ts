export type StorageResult<T> = { ok: true; value: T } | { ok: false; value: null };

export function readStorage(key: string): StorageResult<string | null> {
  try {
    return { ok: true, value: window.localStorage.getItem(key) };
  } catch {
    return { ok: false, value: null };
  }
}

export function writeStorage(key: string, value: string): boolean {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function readJsonArray(key: string): StorageResult<unknown[]> {
  const raw = readStorage(key);
  if (!raw.ok) return { ok: false, value: null };
  if (!raw.value) return { ok: true, value: [] };
  try {
    const parsed: unknown = JSON.parse(raw.value);
    return { ok: true, value: Array.isArray(parsed) ? parsed : [] };
  } catch {
    return { ok: true, value: [] };
  }
}
