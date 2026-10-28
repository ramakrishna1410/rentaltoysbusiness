import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export interface BoxToy {
  id: string;
  name: string;
  creditCost: number;
  image?: string;
}

interface BoxState {
  toys: BoxToy[];
  credits: number;
  add(t: BoxToy): void;
  remove(id: string): void;
  clear(): void;
  has(id: string): boolean;
}

const BoxContext = createContext<BoxState | null>(null);

/** Toys the customer picked for their next delivery or swap. */
export function BoxProvider({ children }: { children: ReactNode }) {
  const [toys, setToys] = useState<BoxToy[]>([]);
  const value = useMemo<BoxState>(
    () => ({
      toys,
      credits: toys.reduce((s, t) => s + t.creditCost, 0),
      add: (t) => setToys((cur) => (cur.some((x) => x.id === t.id) ? cur : [...cur, t])),
      remove: (id) => setToys((cur) => cur.filter((t) => t.id !== id)),
      clear: () => setToys([]),
      has: (id) => toys.some((t) => t.id === id),
    }),
    [toys],
  );
  return <BoxContext.Provider value={value}>{children}</BoxContext.Provider>;
}

export function useBox() {
  const ctx = useContext(BoxContext);
  if (!ctx) throw new Error('useBox outside BoxProvider');
  return ctx;
}
