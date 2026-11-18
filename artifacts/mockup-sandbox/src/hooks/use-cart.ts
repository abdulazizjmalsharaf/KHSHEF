import { useCallback, useMemo, useState } from 'react';
import { readJsonArray, writeStorage } from '@/lib/safe-storage';
import { getPlan, isPlanId, PLANS, type PlanId } from '@/data/plans';

const KEY = 'kashef:demo-cart';

function load() {
  const r = readJsonArray(KEY);
  if (!r.ok) return { ids: [] as PlanId[], ok: false };
  const seen = new Set(r.value.filter(isPlanId));
  // keep canonical plan order, no duplicates
  return { ids: PLANS.map((p) => p.id).filter((id) => seen.has(id)), ok: true };
}

export function useCart() {
  const [initial] = useState(load);
  const [ids, setIds] = useState<PlanId[]>(initial.ids);
  const [storageFailed, setStorageFailed] = useState(!initial.ok);

  const commit = useCallback((next: PlanId[]) => {
    setIds(next);
    if (!writeStorage(KEY, JSON.stringify(next))) setStorageFailed(true);
  }, []);

  const add = useCallback((id: PlanId) => {
    if (!isPlanId(id)) return;
    setIds((prev) => {
      if (prev.includes(id)) return prev;
      const set = new Set([...prev, id]);
      const next = PLANS.map((p) => p.id).filter((x) => set.has(x));
      if (!writeStorage(KEY, JSON.stringify(next))) setStorageFailed(true);
      return next;
    });
  }, []);

  const remove = useCallback((id: PlanId) => {
    setIds((prev) => {
      const next = prev.filter((x) => x !== id);
      if (!writeStorage(KEY, JSON.stringify(next))) setStorageFailed(true);
      return next;
    });
  }, []);

  const clear = useCallback(() => commit([]), [commit]);
  const items = useMemo(() => ids.map(getPlan), [ids]);
  const totalFils = useMemo(() => items.reduce((s, p) => s + p.priceFils, 0), [items]);

  return { items, ids, has: (id: PlanId) => ids.includes(id), add, remove, clear, totalFils, storageFailed };
}
