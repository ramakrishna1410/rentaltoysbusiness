import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createApiClient, type Role } from '@rentaltoys/shared';
import { storage } from './storage';

const TOKEN_KEY = 'rt.admin.token';
let token: string | null = null;

export const api = createApiClient(process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000', () => token);

export interface Staff {
  id: string;
  name: string;
  role: Role;
}

interface AuthState {
  ready: boolean;
  me: Staff | null;
  signIn(token: string): Promise<void>;
  signOut(): Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<Staff | null>(null);

  const load = useCallback(async () => {
    if (!token) return setMe(null);
    try {
      const user = await api.get<Staff>('/auth/me');
      if (user.role === 'CUSTOMER') throw new Error('Not staff');
      setMe(user);
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
        return load();
      })
      .finally(() => setReady(true));
  }, [load]);

  const value = useMemo<AuthState>(
    () => ({
      ready,
      me,
      async signIn(t) {
        token = t;
        await storage.set(TOKEN_KEY, t);
        await load();
        if (!token) throw new Error('This app is for RentalToys staff only');
      },
      async signOut() {
        token = null;
        await storage.set(TOKEN_KEY, null);
        setMe(null);
      },
    }),
    [ready, me, load],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}
