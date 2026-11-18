import { useCallback, useState } from 'react';
import { readJsonArray, writeStorage } from '@/lib/safe-storage';
import { FEATURES } from '@/data/features';

const KEY = 'kashef:favorite-features';
const VALID = new Set(FEATURES.map((f) => f.id));

function load() {
  const r = readJsonArray(KEY);
  if (!r.ok) return { ids: [] as string[], ok: false };
  return { ids: [...new Set(r.value.filter((v): v is string => typeof v === 'string' && VALID.has(v)))], ok: true };
}

export function useFavorites() {
  const [state] = useState(load);
  const [ids, setIds] = useState<string[]>(state.ids);
  const [storageFailed, setStorageFailed] = useState(!state.ok);

  const toggle = useCallback((id: string) => {
    setIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      if (!writeStorage(KEY, JSON.stringify(next))) setStorageFailed(true);
      return next;
    });
  }, []);

  return { favorites: ids, isFavorite: (id: string) => ids.includes(id), toggle, storageFailed };
}
