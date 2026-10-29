import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { User } from '@/types';
import { authApi, setCurrentToken } from '@/services/api';
import { supabase } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isAdmin: boolean;
  hasPendingPayments: boolean;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  // Start true — we don't know auth state yet
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  // Concurrency: generation counter ensures a stale SIGNED_IN response can't
  // overwrite state from a newer login.
  const syncGeneration = useRef(0);
  const lastSyncedUserId = useRef<string | null>(null);

  // Stable logout stored in ref so checkAndSyncUser always calls the latest version
  const logoutRef = useRef<() => Promise<void>>(async () => {});

  const logout = useCallback(async () => {
    setCurrentToken(null);
    await supabase.auth.signOut();
    setUser(null);
    lastSyncedUserId.current = null;
    syncGeneration.current += 1;
    navigate('/login');
  }, [navigate]);

  useEffect(() => {
    logoutRef.current = logout;
  }, [logout]);

  const checkAndSyncUser = useCallback(async (supabaseUser: any, generation: number) => {
    const email = supabaseUser?.email;

    if (!email?.endsWith('@kgpian.iitkgp.ac.in')) {
      await logoutRef.current();
      alert('Only @kgpian.iitkgp.ac.in emails are allowed');
      return;
    }

    try {
      const response = await authApi.syncUser();

      // Discard if a newer login has already taken over
      if (generation !== syncGeneration.current) return;

      setUser(response.user);
      lastSyncedUserId.current = supabaseUser.id;
    } catch (error: any) {
      if (generation !== syncGeneration.current) return;

      const msg = error?.message || '';
      console.error('[Auth] Sync error:', msg);

      if (msg === 'ACCOUNT_PENDING_APPROVAL') {
        setUser(null);
        alert('Your account is awaiting admin verification. Please wait for approval.');
        await logoutRef.current();
        return;
      }
      if (msg === 'ACCOUNT_REJECTED') {
        setUser(null);
        alert('Your registration was not approved. Please contact an administrator.');
        await logoutRef.current();
        return;
      }
      if (msg === 'ACCOUNT_NOT_FOUND') {
        setUser(null);
        alert('No account found for this email. Please register first.');
        await logoutRef.current();
        return;
      }

      // Network blip — try getCurrentUser as fallback
      try {
        const userData = await authApi.getCurrentUser();
        if (generation !== syncGeneration.current) return;
        setUser(userData as User);
        lastSyncedUserId.current = supabaseUser.id;
      } catch (fallbackErr: any) {
        if (generation !== syncGeneration.current) return;
        const fallbackMsg = fallbackErr?.message || '';
        setUser(null);
        if (
          fallbackMsg === 'ACCOUNT_PENDING_APPROVAL' ||
          fallbackMsg === 'ACCOUNT_REJECTED' ||
          fallbackMsg === 'ACCOUNT_NOT_FOUND'
        ) {
          alert(
            fallbackMsg === 'ACCOUNT_PENDING_APPROVAL'
              ? 'Your account is awaiting admin verification.'
              : fallbackMsg === 'ACCOUNT_NOT_FOUND'
              ? 'No account found for this email. Please register first.'
              : 'Your registration was not approved.'
          );
          await logoutRef.current();
        }
      }
    }
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[Auth] Event:', event);

      if (event === 'INITIAL_SESSION') {
        // Fires once on client init with the stored session (or null).
        // Replacing the separate initAuth() call eliminates the race where
        // initAuth's getSession() returned null before verifyOtp completed,
        // causing isLoading=false to land before SIGNED_IN fired.
        setCurrentToken(session?.access_token ?? null);
        if (session) {
          const gen = ++syncGeneration.current;
          await checkAndSyncUser(session.user, gen);
        }
        setIsLoading(false);
        return;
      }

      if (event === 'SIGNED_IN' && session) {
        // Store token BEFORE any API call so the interceptor can attach it
        setCurrentToken(session.access_token);
        // Signal loading so ProtectedRoute shows a spinner while we sync
        setIsLoading(true);
        const gen = ++syncGeneration.current;
        await checkAndSyncUser(session.user, gen);
        setIsLoading(false);
        return;
      }

      if (event === 'TOKEN_REFRESHED' && session) {
        // Token silently refreshed — update stored token, no re-sync needed
        setCurrentToken(session.access_token);
        return;
      }

      if (event === 'SIGNED_OUT') {
        setCurrentToken(null);
        setUser(null);
        lastSyncedUserId.current = null;
        syncGeneration.current += 1;
        setIsLoading(false);
        return;
      }
    });

    return () => subscription.unsubscribe();
  }, [checkAndSyncUser]);

  const refreshUser = useCallback(async () => {
    try {
      const userData = await authApi.getCurrentUser();
      setUser(userData as User);
    } catch (error) {
      console.error('[Auth] refreshUser error:', error);
    }
  }, []);

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    isAdmin: user?.isAdmin || false,
    hasPendingPayments: user?.hasPendingPayments || false,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
