import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Car, AlertCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

const SupabaseAuthCallback = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        setLoading(true);

        // Clear any existing session to prevent cross-user contamination.
        // scope:'local' clears localStorage without a network round-trip.
        await supabase.auth.signOut({ scope: 'local' });

        const url = new URL(window.location.href);
        const code = url.searchParams.get('code');
        const tokenHash = url.searchParams.get('token_hash');
        const type = url.searchParams.get('type');
        // Supabase error redirects
        const errorCode = url.searchParams.get('error_code');
        const errorDesc = url.searchParams.get('error_description');

        if (errorCode || errorDesc) {
          throw new Error(errorDesc?.replace(/\+/g, ' ') || errorCode || 'Authentication error');
        }

        if (tokenHash && type) {
          // Token-hash flow — works in any browser/webview, no code_verifier needed.
          // This is the mobile-safe path used when the Supabase email template
          // sends ?token_hash=...&type=magiclink instead of the PKCE ?code=...
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type as any
          });
          if (error) throw error;
        } else if (code) {
          // PKCE flow — requires the same browser that initiated the login
          // (code_verifier is stored there). Fails in Gmail/email-app webviews.
          const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
          if (error) {
            if (
              error.message?.includes('code verifier') ||
              error.message?.includes('code_verifier') ||
              error.message?.includes('non-empty')
            ) {
              throw new Error(
                'Please open this link in the same browser you used to request the sign-in link, ' +
                'or go to kuchlachati.iitkgpcabs.in/login and request a new link.'
              );
            }
            throw error;
          }
        } else {
          throw new Error(
            'No sign-in token found. Please request a new sign-in link from the login page.'
          );
        }

        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        if (!session) {
          setError('No active session found. Please request a new sign-in link.');
          setLoading(false);
          return;
        }

        const user = session.user;
        if (user && !user.email?.endsWith('@kgpian.iitkgp.ac.in')) {
          await supabase.auth.signOut();
          setError('Only @kgpian.iitkgp.ac.in emails are allowed.');
          setLoading(false);
          return;
        }

        // AuthContext handles syncing via onAuthStateChange
        navigate('/dashboard', { replace: true });
      } catch (err: any) {
        console.error('Auth callback error:', err);
        setError(err.message || 'Authentication failed.');
        setLoading(false);
      }
    };

    handleAuthCallback();
  }, [navigate]);

  const handleRetry = () => {
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
            <div className="flex gap-4 justify-center">
              <Button onClick={handleRetry} className="bg-emerald-600 hover:bg-emerald-700">
                Back to Login
              </Button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};

export default SupabaseAuthCallback;
