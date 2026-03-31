import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Car, AlertCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

const SupabaseAuthCallback = () => {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        setLoading(true);
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) throw sessionError;
        
        if (!session) {
          // If no session, wait a bit for potential hash parsing
          await new Promise(resolve => setTimeout(resolve, 1000));
          const { data: { session: retrySession } } = await supabase.auth.getSession();
          if (!retrySession) {
            setError('No active session found.');
            setLoading(false);
            return;
          }
        }

        const { data: { session: finalSession } } = await supabase.auth.getSession();
        const user = finalSession?.user;

        if (user && !user.email?.endsWith('@kgpian.iitkgp.ac.in')) {
          await supabase.auth.signOut();
          setError('Only @kgpian.iitkgp.ac.in emails are allowed.');
          setLoading(false);
          return;
        }

        // AuthContext handles syncing via onAuthStateChange
        // We just need to wait a bit and redirect
        setTimeout(() => {
          navigate('/dashboard', { replace: true });
        }, 1500);

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
