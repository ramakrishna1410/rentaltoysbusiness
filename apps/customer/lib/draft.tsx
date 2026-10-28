import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { ColorFilter, Interest, ParentGoal, PlayPlace } from '@rentaltoys/shared';
import { storage } from './storage';

const KEY = 'rt.getStarted';

/** Answers from "Get started", kept on the device until the parent signs up. */
export interface GuestDraft {
  kidName: string;
  dateOfBirth: string; // YYYY-MM-DD
  gender: string | null;
  favoriteColors: ColorFilter[];
  interests: Interest[];
  playPlace: PlayPlace | null;
  goals: ParentGoal[];
  pincode: string;
}

export const emptyDraft = (): GuestDraft => ({
  kidName: '',
  dateOfBirth: '',
  gender: null,
  favoriteColors: [],
  interests: [],
  playPlace: null,
  goals: [],
  pincode: '',
});

interface DraftState {
  draft: GuestDraft | null;
  save(d: GuestDraft): void;
  clear(): void;
}

const DraftContext = createContext<DraftState | null>(null);

export function DraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<GuestDraft | null>(null);
  useEffect(() => {
    storage
      .get(KEY)
      .then((raw) => raw && setDraft({ ...emptyDraft(), ...JSON.parse(raw) }))
      .catch(() => undefined);
  }, []);
  const save = useCallback((d: GuestDraft) => {
    setDraft(d);
    storage.set(KEY, JSON.stringify(d)).catch(() => undefined);
  }, []);
  const clear = useCallback(() => {
    setDraft(null);
    storage.set(KEY, null).catch(() => undefined);
  }, []);
  const value = useMemo(() => ({ draft, save, clear }), [draft, save, clear]);
  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
}

export function useDraft() {
  const ctx = useContext(DraftContext);
  if (!ctx) throw new Error('useDraft outside DraftProvider');
  return ctx;
}

/** Query string the catalog uses to rank for a guest's answers. */
export function draftQuery(d: GuestDraft, ageMonths: number | null): string {
  const p = new URLSearchParams();
  if (ageMonths !== null) p.set('kidAgeMonths', String(ageMonths));
  if (d.interests.length) p.set('likes', d.interests.join(','));
  if (d.favoriteColors.length) p.set('colors', d.favoriteColors.join(','));
  if (d.playPlace) p.set('playPlace', d.playPlace);
  if (d.goals.length) p.set('goals', d.goals.join(','));
  return p.toString();
}
