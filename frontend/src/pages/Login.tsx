import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Car, Loader2, Mail } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const Login = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [emailPrefix, setEmailPrefix] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  const handleOTPLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailPrefix) {
      toast.error('Please enter your email prefix');
      return;
    }

    const email = `${emailPrefix.toLowerCase().trim()}@kgpian.iitkgp.ac.in`;

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.origin + '/dashboard',
        }
      });

      if (error) throw error;

      setOtpSent(true);
      toast.success('OTP sent to your email');
    } catch (error: any) {
      console.error('OTP error:', error);
      toast.error(error.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const verifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp) {
      toast.error('Please enter the OTP');
      return;
    }

    const email = `${emailPrefix.toLowerCase().trim()}@kgpian.iitkgp.ac.in`;

    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: 'magiclink' // Or 'otp' depending on Supabase config, magiclink usually works for email OTP
      });

      if (error) throw error;

      toast.success('Logged in successfully');
      navigate('/dashboard');
    } catch (error: any) {
      console.error('Verify error:', error);
      toast.error(error.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + '/dashboard',
          queryParams: {
            hd: 'kgpian.iitkgp.ac.in' // Google domain restriction hint
          }
        }
      });
      if (error) throw error;
    } catch (error: any) {
      console.error('Google login error:', error);
      toast.error(error.message || 'Failed to login with Google');
      setLoading(false);
    }
  };

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
          <CardHeader>
            <CardTitle className="text-2xl text-white">Log In</CardTitle>
            <CardDescription className="text-slate-400">
              {otpSent ? 'Enter the OTP sent to your email' : 'Enter your institute email prefix'}
            </CardDescription>
          </CardHeader>
          
          {!otpSent ? (
            <form onSubmit={handleOTPLogin}>
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
                      disabled={loading}
                    />
                    <div className="bg-slate-800 border border-l-0 border-slate-700 text-slate-400 px-3 flex items-center rounded-r-md text-sm font-medium whitespace-nowrap">
                      @kgpian.iitkgp.ac.in
                    </div>
                  </div>
                </div>

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
                  disabled={loading}
                >
                  <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
                    <path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path>
                  </svg>
                  Google
                </Button>
              </CardContent>
              <CardFooter className="flex flex-col space-y-4 pt-2">
                <Button 
                  type="submit" 
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11"
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Mail className="mr-2 h-4 w-4" />
                  )}
                  SEND OTP
                </Button>
                <div className="text-center text-sm text-slate-400">
                  By logging in, you agree to our terms
                </div>
              </CardFooter>
            </form>
          ) : (
            <form onSubmit={verifyOTP}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="otp" className="text-slate-300">OTP Code</Label>
                  <Input
                    id="otp"
                    placeholder="Enter 6-digit code"
                    className="bg-slate-800 border-slate-700 text-white focus-visible:ring-emerald-500 text-center text-2xl tracking-widest"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    disabled={loading}
                    maxLength={6}
                  />
                  <p className="text-xs text-slate-400 text-center">
                    OTP sent to {emailPrefix}@kgpian.iitkgp.ac.in
                  </p>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col space-y-4 pt-2">
                <Button 
                  type="submit" 
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11"
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    'VERIFY OTP'
                  )}
                </Button>
                <Button 
                  type="button" 
                  variant="ghost"
                  className="w-full text-slate-400 hover:text-white"
                  onClick={() => setOtpSent(false)}
                  disabled={loading}
                >
                  Change Email
                </Button>
              </CardFooter>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Login;