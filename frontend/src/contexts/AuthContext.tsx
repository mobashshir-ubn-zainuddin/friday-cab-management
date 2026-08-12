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

// Sync cache duration: 10 minutes (increased to reduce unnecessary syncs)
const SYNC_CACHE_DURATION = 10 * 60 * 1000;

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  // Refs for deduplication
  const lastSyncedUserId = useRef<string | null>(null);
  const lastSyncTime = useRef<number>(0);
  const syncInProgress = useRef<boolean>(false);
  const currentSessionRef = useRef<{ user: any; expiresAt: number } | null>(null);
  const hasInitialized = useRef<boolean>(false);

  // Check if cached user data is still valid
  const isCacheValid = useCallback((userId: string): boolean => {
    const now = Date.now();
    return (
      lastSyncedUserId.current === userId &&
      now - lastSyncTime.current < SYNC_CACHE_DURATION &&
      user !== null
    );
  }, [user]);

  const checkAndSyncUser = useCallback(async (supabaseUser: any) => {
    const email = supabaseUser.email;
    if (!email?.endsWith('@kgpian.iitkgp.ac.in')) {
      console.error('Unauthorized domain');
      await logout();
      alert('Only @kgpian.iitkgp.ac.in emails are allowed');
      return;
    }

    const userId = supabaseUser.id;

    // Deduplication: skip if same user synced recently
    if (isCacheValid(userId)) {
      console.log('[Auth] Skipping sync - cached user still valid');
      return;
    }

    // Prevent concurrent sync calls for same user
    if (syncInProgress.current && lastSyncedUserId.current === userId) {
      console.log('[Auth] Sync already in progress for this user, waiting...');
      // Wait for existing sync to complete (max 10 seconds)
      let waitTime = 0;
      while (syncInProgress.current && waitTime < 10000) {
        await new Promise(resolve => setTimeout(resolve, 100));
        waitTime += 100;
      }
      return;
    }

    syncInProgress.current = true;

    try {
      // Sync user with backend
      const response = await authApi.syncUser();
      const userData = response.user;
      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
      lastSyncedUserId.current = userId;
      lastSyncTime.current = Date.now();
      currentSessionRef.current = { user: supabaseUser, expiresAt: Date.now() + SYNC_CACHE_DURATION };
    } catch (error: any) {
      console.error('Error syncing user:', error);

      const errorMsg = error?.message || '';
      if (errorMsg === 'ACCOUNT_PENDING_APPROVAL') {
        setUser(null);
        localStorage.removeItem('user');
        alert('Your account is awaiting admin verification. Please wait for an admin to approve your registration.');
        await logout();
        return;
      }

      if (errorMsg === 'ACCOUNT_REJECTED') {
        setUser(null);
        localStorage.removeItem('user');
        alert('Your registration was not approved. Please contact an administrator.');
        await logout();
        return;
      }

      // If sync fails for other reasons, try fetching current user
      try {
        const userData = await authApi.getCurrentUser();
        setUser(userData as User);
        localStorage.setItem('user', JSON.stringify(userData));
        lastSyncedUserId.current = userId;
        lastSyncTime.current = Date.now();
      } catch (err: any) {
        console.error('Error fetching current user:', err);
        const currentErrorMsg = err?.message || '';
        if (currentErrorMsg === 'ACCOUNT_PENDING_APPROVAL' || currentErrorMsg === 'ACCOUNT_REJECTED') {
          setUser(null);
          localStorage.removeItem('user');
          alert(currentErrorMsg === 'ACCOUNT_PENDING_APPROVAL'
            ? 'Your account is awaiting admin verification.'
            : 'Your registration was not approved.');
          await logout();
        }
      }
    } finally {
      syncInProgress.current = false;
    }
  }, [isCacheValid]);

  const initAuth = useCallback(async () => {
    // Prevent double initialization
    if (hasInitialized.current) {
      setIsLoading(false);
      return;
    }
    hasInitialized.current = true;

    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      localStorage.setItem('token', session.access_token);
      // Store session for token refresh detection
      currentSessionRef.current = { 
        user: session.user, 
        expiresAt: Date.now() + SYNC_CACHE_DURATION 
      };
      await checkAndSyncUser(session.user);
    }
    setIsLoading(false);
  }, [checkAndSyncUser]);

  useEffect(() => {
    // Listen for auth changes - ONLY sync on SIGNED_IN, not on token refresh
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth event:', event);
      
      if (session) {
        localStorage.setItem('token', session.access_token);
        
        // Only sync on SIGNED_IN (initial login)
        // Skip TOKEN_REFRESHED and USER_UPDATED to avoid repeated syncs
        // USER_UPDATED will be handled by explicit refreshUser() calls
        if (event === 'SIGNED_IN') {
          await checkAndSyncUser(session.user);
        } else if (event === 'TOKEN_REFRESHED') {
          // Token silently refreshed - just update stored token, don't resync user
          console.log('[Auth] Token refreshed, skipping user sync');
        }
      } else {
        // SIGNED_OUT
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
        lastSyncedUserId.current = null;
        lastSyncTime.current = 0;
        currentSessionRef.current = null;
        hasInitialized.current = false;
      }
      setIsLoading(false);
    });

    // Initial session check
    initAuth();

    return () => {
      subscription.unsubscribe();
    };
  }, [initAuth, checkAndSyncUser]);

  const logout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    lastSyncedUserId.current = null;
    lastSyncTime.current = 0;
    currentSessionRef.current = null;
    hasInitialized.current = false;
    navigate('/login');
  };

  const refreshUser = async () => {
    try {
      const userData = await authApi.getCurrentUser();
      setUser(userData as User);
      localStorage.setItem('user', JSON.stringify(userData));
      if (currentSessionRef.current?.user) {
        lastSyncedUserId.current = currentSessionRef.current.user.id;
        lastSyncTime.current = Date.now();
      }
    } catch (error) {
      console.error('Error refreshing user:', error);
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    isAdmin: user?.isAdmin || false,
    hasPendingPayments: user?.hasPendingPayments || false,
    logout,
    refreshUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;