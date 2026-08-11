import React, { createContext, useContext, useState, useEffect } from 'react';
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

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth event:', event);
      if (session) {
        localStorage.setItem('token', session.access_token);
        await checkAndSyncUser(session.user);
      } else {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
      }
      setIsLoading(false);
    });

    // Initial session check
    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        localStorage.setItem('token', session.access_token);
        await checkAndSyncUser(session.user);
      }
      setIsLoading(false);
    };

    initAuth();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const checkAndSyncUser = async (supabaseUser: any) => {
    const email = supabaseUser.email;
    if (!email?.endsWith('@kgpian.iitkgp.ac.in')) {
      console.error('Unauthorized domain');
      await logout();
      alert('Only @kgpian.iitkgp.ac.in emails are allowed');
      return;
    }

    try {
      // Sync user with backend
      const response = await authApi.syncUser();
      const userData = response.user;
      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
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
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    navigate('/login');
  };

  const refreshUser = async () => {
    try {
      const userData = await authApi.getCurrentUser();
      setUser(userData as User);
      localStorage.setItem('user', JSON.stringify(userData));
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
