'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useAuth } from '@/features/auth/hooks/use-auth';
import type { AuthUser } from '@abdcshare/api-client';
import type { Permission } from '@abdcshare/shared';

interface AuthContextValue {
  user: AuthUser | undefined;
  isPending: boolean;
  isError: boolean;
  can: (permission: Permission) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  return (
    <AuthContext.Provider
      value={{
        user: auth.user,
        isPending: auth.isPending,
        isError: auth.isError,
        can: auth.can,
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
