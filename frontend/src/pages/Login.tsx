import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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
                <div className="text-center text-sm text-slate-400">
                  New here?{' '}
                  <Link to="/register" className="text-emerald-500 hover:text-emerald-400 font-medium">
                    Create an account
                  </Link>
                </div>
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
                      disabled={emailLoading}
                    />
                    <div className="bg-slate-800 border border-l-0 border-slate-700 text-slate-400 px-3 flex items-center rounded-r-md text-sm font-medium whitespace-nowrap">
                      @kgpian.iitkgp.ac.in
                    </div>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11"
                  disabled={emailLoading}
                >
                  {emailLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Mail className="mr-2 h-4 w-4" />
                  )}
                  SEND SIGN-IN LINK
                </Button>
              </CardContent>
              <CardFooter className="flex flex-col space-y-4 pt-2">
                <div className="text-center text-sm text-slate-400">
                  New here?{' '}
                  <Link to="/register" className="text-emerald-500 hover:text-emerald-400 font-medium">
                    Create an account
                  </Link>
                </div>
                <div className="text-center text-xs text-slate-500">
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
