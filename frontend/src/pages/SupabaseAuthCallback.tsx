import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Car, AlertCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

const SupabaseAuthCallback = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [error, setError] = useState('');
  // expectedUserId: the Supabase user ID confirmed by verifyOtp/exchangeCode.
  // We navigate to /dashboard ONLY once user.supabaseUserId matches this,
  // ensuring we never forward on a leftover session from a different user.
  const [expectedUserId, setExpectedUserId] = useState<string | null>(null);
  // processed: true once verifyOtp (or an error) has completed
  const [processed, setProcessed] = useState(false);
  // Guard against React StrictMode running the effect twice
  const processingRef = useRef(false);

  // Step 1: Verify the token/code from the callback URL exactly once
  useEffect(() => {
    if (processingRef.current) return;
    processingRef.current = true;

    const processToken = async () => {
      try {
        const url = new URL(window.location.href);
        const tokenHash = url.searchParams.get('token_hash');
        const type = url.searchParams.get('type');
        const code = url.searchParams.get('code');
        const errorCode = url.searchParams.get('error_code');
        const errorDesc = url.searchParams.get('error_description');

        if (errorCode || errorDesc) {
          throw new Error(
            (errorDesc ?? '').replace(/\+/g, ' ') ||
            errorCode ||
            'Authentication error from provider'
          );
        }

        if (tokenHash && type) {
          // Token-hash flow: no PKCE verifier needed, works in any webview.
          // Used when Supabase email template sends ?token_hash=...&type=magiclink
          console.log('[Callback] Processing token_hash flow');
          const { error: otpErr } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type as any,
          });
          if (otpErr) throw otpErr;
        } else if (code) {
          // PKCE flow: requires same browser that initiated login (code_verifier in sessionStorage).
          console.log('[Callback] Processing PKCE code flow');
          const { error: codeErr } = await supabase.auth.exchangeCodeForSession(
            window.location.href
          );
          if (codeErr) {
            if (
              codeErr.message?.includes('code verifier') ||
              codeErr.message?.includes('code_verifier') ||
              codeErr.message?.includes('non-empty')
            ) {
              throw new Error(
                'Please open this link in the same browser you used to request the sign-in link, ' +
                'or go to the login page and request a new link.'
              );
            }
            throw codeErr;
          }
        } else {
          throw new Error(
            'No sign-in token found in the link. Please request a new sign-in link from the login page.'
          );
        }

        // Grab the session Supabase just created so we can verify identity correlation
        const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
        if (sessionErr) throw sessionErr;
        if (!session) throw new Error('Session was not created. Please try again.');

        const uid = session.user.id;
        const email = session.user.email ?? '';

        if (!email.endsWith('@kgpian.iitkgp.ac.in')) {
          await supabase.auth.signOut();
          throw new Error('Only @kgpian.iitkgp.ac.in email addresses are allowed.');
        }

        console.log('[Callback] Token verified for Supabase user:', uid);
        setExpectedUserId(uid);
      } catch (err: any) {
        console.error('[Callback] Error:', err.message);
        setError(err.message || 'Authentication failed. Please try again.');
      } finally {
        setProcessed(true);
      }
    };

    processToken();
  }, []);

  // Step 2: Once verifyOtp succeeded AND AuthContext has synced the exact user,
  // navigate. We match on supabaseUserId (not just "any user is set") so that
  // a previous user's session can never trigger a navigation.
  useEffect(() => {
    if (!processed || error || !expectedUserId) return;

    if (user?.supabaseUserId === expectedUserId) {
      // AuthContext confirmed this exact user is authenticated and approved
      console.log('[Callback] Identity confirmed, navigating to dashboard');
      navigate('/dashboard', { replace: true });
    }
    // If user is null, AuthContext is either still syncing (isLoading) or
    // already called logout() → navigate('/login') for us. Either way, wait.
  }, [processed, error, expectedUserId, user, navigate]);

  // Safety timeout: if AuthContext hasn't resolved within 20 seconds,
  // something went badly wrong — send the user back to login.
  useEffect(() => {
    if (!processed || error || !expectedUserId) return;
    const t = setTimeout(() => {
      console.warn('[Callback] Timeout waiting for auth sync');
      navigate('/login', { replace: true });
    }, 20_000);
    return () => clearTimeout(t);
  }, [processed, error, expectedUserId, navigate]);

  const showLoading = !error && (!processed || !expectedUserId || user?.supabaseUserId !== expectedUserId);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="text-center space-y-6 max-w-md">
        {showLoading ? (
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
            <h1 className="text-xl font-semibold text-white">Authentication Failed</h1>
            <Alert variant="destructive" className="bg-red-950/50 border-red-800 text-red-200">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <Button
              onClick={() => navigate('/login')}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Back to Login
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
};

export default SupabaseAuthCallback;
