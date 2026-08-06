import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Car, Loader2, Mail, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const CALLBACK_URL = `${window.location.origin}/auth/callback`;

const Login = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [emailPrefix, setEmailPrefix] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  const handleMagicLinkLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailPrefix) {
      toast.error('Please enter your email prefix');
      return;
    }

    const email = `${emailPrefix.toLowerCase().trim()}@kgpian.iitkgp.ac.in`;

    setEmailLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: CALLBACK_URL,
        }
      });

      if (error) throw error;

      setMagicLinkSent(true);
      toast.success('Check your email for the sign-in link');
    } catch (error: any) {
      console.error('Magic link error:', error);
      toast.error(error.message || 'Failed to send sign-in link');
    } finally {
      setEmailLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: CALLBACK_URL,
          queryParams: {
            hd: 'kgpian.iitkgp.ac.in'
          }
        }
      });
      if (error) throw error;
    } catch (error: any) {
      console.error('Google login error:', error);
      toast.error(error.message || 'Failed to login with Google');
      setGoogleLoading(false);
    }
  };

  const sentEmail = `${emailPrefix.toLowerCase().trim()}@kgpian.iitkgp.ac.in`;

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-500 rounded-2xl mb-4">
            <Car className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Friday Cab</h1>
          <p className="text-slate-400 mt-2">Log In to your account</p>
        </div>

        <Card className="bg-slate-900 border-slate-800">
          {magicLinkSent ? (
            <>
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                </div>
                <CardTitle className="text-2xl text-white">Check your email</CardTitle>
                <CardDescription className="text-slate-400">
                  A secure sign-in link has been sent to{' '}
                  <span className="font-medium text-slate-200">{sentEmail}</span>.
                  Click the link to continue.
                </CardDescription>
              </CardHeader>
              <CardFooter className="flex flex-col space-y-4 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-slate-400 hover:text-white"
                  onClick={() => setMagicLinkSent(false)}
                >
                  Use a different email
                </Button>
              </CardFooter>
            </>
          ) : (
            <form onSubmit={handleMagicLinkLogin}>
              <CardHeader>
                <CardTitle className="text-2xl text-white">Log In</CardTitle>
                <CardDescription className="text-slate-400">
                  Enter your institute email prefix
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-300">Institute Email</Label>
                  <div className="flex">
                    <Input
                      id="email"
                      placeholder="e.g. mobo"
                      className="bg-slate-800 border-slate-700 text-white rounded-r-none focus-visible:ring-emerald-500"
                      value={emailPrefix}
                      onChange={(e) => setEmailPrefix(e.target.value)}
                      disabled={emailLoading || googleLoading}
                    />
                    <div className="bg-slate-800 border border-l-0 border-slate-700 text-slate-400 px-3 flex items-center rounded-r-md text-sm font-medium whitespace-nowrap">
                      @kgpian.iitkgp.ac.in
                    </div>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11"
                  disabled={emailLoading || googleLoading}
                >
                  {emailLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Mail className="mr-2 h-4 w-4" />
                  )}
                  SEND EMAIL
                </Button>

                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-slate-800" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-slate-900 px-2 text-slate-500 font-medium">Or continue with</span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full bg-slate-800 border-slate-700 text-white hover:bg-slate-700 hover:text-white"
                  onClick={handleGoogleLogin}
                  disabled={emailLoading || googleLoading}
                >
                  {googleLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
                      <path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path>
                    </svg>
                  )}
                  Google
                </Button>
              </CardContent>
              <CardFooter className="flex flex-col space-y-4 pt-2">
                <div className="text-center text-sm text-slate-400">
                  By logging in, you agree to our terms
                </div>
              </CardFooter>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Login;
