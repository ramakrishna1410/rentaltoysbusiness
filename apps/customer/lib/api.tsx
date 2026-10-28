import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createApiClient, type ColorFilter, type Interest, type ParentGoal, type PlayPlace } from '@rentaltoys/shared';
import { storage } from './storage';

const TOKEN_KEY = 'rt.customer.token';
let token: string | null = null;

export const api = createApiClient(process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000', () => token);

export interface Kid {
  id: string;
  name: string;
  dateOfBirth: string;
  interests: Interest[];
  favoriteColors: ColorFilter[];
  playPlace: PlayPlace | null;
  goals: ParentGoal[];
}

export interface Me {
  id: string;
  name: string;
  email: string;
  phone: string;
  kids: Kid[];
}

interface AuthState {
  ready: boolean;
  me: Me | null;
  activeKidId: string | null;
  setActiveKidId(id: string): void;
  signIn(token: string): Promise<void>;
  signOut(): Promise<void>;
  refresh(): Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const [activeKidId, setActiveKidId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!token) {
      setMe(null);
      return;
    }
    try {
      const user = await api.get<Me>('/auth/me');
      setMe(user);
      setActiveKidId((cur) => (cur && user.kids.some((k) => k.id === cur) ? cur : (user.kids[0]?.id ?? null)));
    } catch {
      token = null;
      await storage.set(TOKEN_KEY, null);
      setMe(null);
    }
  }, []);

  useEffect(() => {
    storage
      .get(TOKEN_KEY)
      .then((t) => {
        token = t;
        return refresh();
      })
      .finally(() => setReady(true));
  }, [refresh]);

  const value = useMemo<AuthState>(
    () => ({
      ready,
      me,
      activeKidId,
      setActiveKidId,
      async signIn(t) {
        token = t;
        await storage.set(TOKEN_KEY, t);
        await refresh();
      },
      async signOut() {
        token = null;
        await storage.set(TOKEN_KEY, null);
        setMe(null);
      },
      refresh,
    }),
    [ready, me, activeKidId, refresh],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}
