import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { User } from '@/types';
import { authApi } from '@/services/api';
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

const SYNC_CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  const lastSyncedUserId = useRef<string | null>(null);
  const lastSyncTime = useRef<number>(0);
  const syncInProgress = useRef<boolean>(false);
  const hasInitialized = useRef<boolean>(false);

  // Use a ref so checkAndSyncUser can call the latest logout without stale closure
  const logoutRef = useRef<() => Promise<void>>(async () => {});

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    lastSyncedUserId.current = null;
    lastSyncTime.current = 0;
    syncInProgress.current = false;
    hasInitialized.current = false;
    navigate('/login');
  }, [navigate]);

  // Keep ref in sync with the latest logout
  useEffect(() => {
    logoutRef.current = logout;
  }, [logout]);

  const isCacheValid = useCallback((userId: string): boolean => {
    return (
      lastSyncedUserId.current === userId &&
      Date.now() - lastSyncTime.current < SYNC_CACHE_DURATION &&
      user !== null
    );
  }, [user]);

  const checkAndSyncUser = useCallback(async (supabaseUser: any) => {
    const email = supabaseUser.email;

    if (!email?.endsWith('@kgpian.iitkgp.ac.in')) {
      await logoutRef.current();
      alert('Only @kgpian.iitkgp.ac.in emails are allowed');
      return;
    }

    const userId = supabaseUser.id;

    if (isCacheValid(userId)) {
      console.log('[Auth] Skipping sync - cache valid');
      return;
    }

    // Prevent concurrent syncs for the same user
    if (syncInProgress.current && lastSyncedUserId.current === userId) {
      let waited = 0;
      while (syncInProgress.current && waited < 10000) {
        await new Promise(r => setTimeout(r, 100));
        waited += 100;
      }
      return;
    }

    syncInProgress.current = true;

    try {
      const response = await authApi.syncUser();
      setUser(response.user);
      lastSyncedUserId.current = userId;
      lastSyncTime.current = Date.now();
    } catch (error: any) {
      const msg = error?.message || '';
      console.error('[Auth] Sync error:', msg);

      if (msg === 'ACCOUNT_PENDING_APPROVAL') {
        setUser(null);
        alert('Your account is awaiting admin verification. Please wait for an admin to approve your registration.');
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

      // For other errors (network blip etc.), try getCurrentUser as fallback
      try {
        const userData = await authApi.getCurrentUser();
        setUser(userData as User);
        lastSyncedUserId.current = userId;
        lastSyncTime.current = Date.now();
      } catch (fallbackErr: any) {
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
    } finally {
      syncInProgress.current = false;
    }
  }, [isCacheValid]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[Auth] Event:', event);

      if (event === 'SIGNED_IN' && session) {
        // Set loading immediately so ProtectedRoute waits for the sync to complete
        setIsLoading(true);
        await checkAndSyncUser(session.user);
        setIsLoading(false);
        return;
      }

      if (event === 'SIGNED_OUT') {
        setUser(null);
        lastSyncedUserId.current = null;
        lastSyncTime.current = 0;
        syncInProgress.current = false;
        hasInitialized.current = false;
        setIsLoading(false);
        return;
      }

      // TOKEN_REFRESHED, USER_UPDATED — no re-sync needed
      setIsLoading(false);
    });

    // Check for an existing session on mount (e.g. page refresh within same tab)
    const initAuth = async () => {
      if (hasInitialized.current) {
        setIsLoading(false);
        return;
      }
      hasInitialized.current = true;

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await checkAndSyncUser(session.user);
      }
      setIsLoading(false);
    };

    initAuth();

    return () => subscription.unsubscribe();
  }, [checkAndSyncUser]);

  const refreshUser = useCallback(async () => {
    try {
      const userData = await authApi.getCurrentUser();
      setUser(userData as User);
      if (lastSyncedUserId.current) {
        lastSyncTime.current = Date.now();
      }
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
