'use client';

import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useAuth } from '@/features/auth/hooks/use-auth';
import type { AuthUser } from '@abdcshare/api-client';
import { hasPermission, type Permission, type RoleName } from '@abdcshare/shared';
import { useAuthStore } from '@/store/useAuthStore';

interface AuthContextValue {
  user: AuthUser | undefined;
  isAuthenticated: boolean;
  isPending: boolean;
  isError: boolean;
  can: (permission: Permission) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const storeUser = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setUser = useAuthStore((s) => s.setUser);
  const clearUser = useAuthStore((s) => s.clearUser);

  // Sync /me Query → Zustand (Ondoo ClientAppShell pattern)
  useEffect(() => {
    if (auth.user) {
      setUser(auth.user);
      return;
    }
    if (auth.isError) {
      clearUser();
    }
  }, [auth.user, auth.isError, setUser, clearUser]);

  // Prefer live Query user; fall back to persisted store for instant shell paint
  const user = auth.user ?? storeUser ?? undefined;

  const can = (permission: Permission): boolean => {
    if (!user) return false;
    const role = user.role as RoleName;
    return hasPermission(role, permission, user.partnerDesignation ?? null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user) || isAuthenticated,
        isPending: auth.isPending,
        isError: auth.isError,
        can,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider');
  return ctx;
}
