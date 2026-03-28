import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Car, AlertCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

const SupabaseAuthCallback = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // STRICT validation: Only IITKGP emails allowed
  const isValidIITKGPEmail = (email: string): boolean => {
    const lowerEmail = email.toLowerCase().trim();
    return lowerEmail.endsWith('@kgpian.iitkgp.ac.in');
  };

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        setLoading(true);

        // Get the current session from Supabase
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('Session error:', sessionError);
          setError('Authentication failed. Please try again.');
          setLoading(false);
          return;
        }

        let user = session?.user;

        if (!user) {
          // Check if there's a hash fragment from OAuth redirect
          const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();

          if (userError || !currentUser) {
            console.error('User error:', userError);
            setError('Authentication failed. Please try again.');
            setLoading(false);
            return;
          }

          user = currentUser;
        }

        // STRICT: Validate IITKGP email
        const userEmail = user.email || '';

        if (!isValidIITKGPEmail(userEmail)) {
          // Sign out the user immediately
          await supabase.auth.signOut();
          setError(`Access Denied: Only @kgpian.iitkgp.ac.in emails are allowed. Your email (${userEmail}) is not authorized.`);
          setLoading(false);
          return;
        }

        // Store user in backend database via API
        await syncUserWithBackend(user);

      } catch (err) {
        console.error('Auth callback error:', err);
        setError('An unexpected error occurred. Please try again.');
        setLoading(false);
      }
    };

    const syncUserWithBackend = async (supabaseUser: any) => {
      try {
        // Sync user with backend database using Prisma
        const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/supabase/callback`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: supabaseUser.email,
            name: supabaseUser.user_metadata?.full_name || supabaseUser.user_metadata?.name || supabaseUser.email?.split('@')[0],
            avatar_url: supabaseUser.user_metadata?.avatar_url,
            provider: 'google',
            provider_id: supabaseUser.id
          })
        });

        const result = await response.json();

        if (result.success) {
          const { token, user: userData } = result.data;

          // Login using the AuthContext
          login(token, userData);

          // Redirect to dashboard
          navigate('/dashboard', { replace: true });
        } else {
          throw new Error(result.error || 'Failed to sync user');
        }
      } catch (err: any) {
        console.error('Backend sync error:', err);

        // Display the error message from the backend
        setError(err.message || 'Failed to complete login. Please try again.');

        // Sign out from Supabase since sync failed
        await supabase.auth.signOut();
        setLoading(false);
      }
    };

    handleAuthCallback();
  }, [navigate, login]);

  const handleRetry = () => {
    navigate('/login');
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="text-center space-y-6 max-w-md">
        {loading && !error ? (
          <>
            <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center mx-auto animate-pulse">
              <Car className="w-8 h-8 text-white" />
            </div>
            <div className="space-y-2">
              <h1 className="text-xl font-semibold text-white">Authenticating...</h1>
              <p className="text-slate-400">Please wait while we verify your credentials</p>
            </div>
            <Loader2 className="w-6 h-6 text-emerald-500 animate-spin mx-auto" />
          </>
        ) : error ? (
          <>
            <div className="w-16 h-16 bg-red-500 rounded-2xl flex items-center justify-center mx-auto">
              <AlertCircle className="w-8 h-8 text-white" />
            </div>
            <div className="space-y-2">
              <h1 className="text-xl font-semibold text-white">Access Denied</h1>
            </div>
            <Alert variant="destructive" className="bg-red-950/50 border-red-800 text-red-200">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <div className="flex gap-3 justify-center">
              <Button onClick={handleRetry} variant="outline" className="border-slate-700 text-white hover:bg-slate-800">
                Try Again
              </Button>
              <Button onClick={handleSignOut} className="bg-emerald-600 hover:bg-emerald-700">
                Sign Out
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center mx-auto">
              <Car className="w-8 h-8 text-white" />
            </div>
            <div className="space-y-2">
              <h1 className="text-xl font-semibold text-white">Login Successful!</h1>
              <p className="text-slate-400">Redirecting you to dashboard...</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SupabaseAuthCallback;
