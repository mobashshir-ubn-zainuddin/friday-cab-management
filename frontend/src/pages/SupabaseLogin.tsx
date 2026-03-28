import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Car, Mail, Shield, Users, Clock, CreditCard, AlertCircle } from 'lucide-react';

const Login = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Check for error in URL
  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam) {
      setError(decodeURIComponent(errorParam));
    }
  }, [searchParams]);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  // STRICT validation: Only IITKGP emails allowed
  // const isValidIITKGPEmail = (email: string): boolean => {
  //   const lowerEmail = email.toLowerCase().trim();
  //   return lowerEmail.endsWith('@kgpian.iitkgp.ac.in');
  // };

  const handleSupabaseGoogleLogin = async () => {
    try {
      setLoading(true);
      setError('');

      const { data, error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent'
          }
        }
      });

      if (authError) {
        setError(authError.message);
        return;
      }

      // The user will be redirected to Google OAuth
      console.log('OAuth URL:', data?.url);
    } catch (err) {
      console.error('Login error:', err);
      setError('Failed to initiate login. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Alternative: Direct backend OAuth (existing flow)
  const handleBackendGoogleLogin = () => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    window.location.href = `${apiUrl}/auth/google`;
  };

  const features = [
    {
      icon: Car,
      title: 'Easy Cab Booking',
      description: 'Book your ride for Friday prayer with just one click'
    },
    {
      icon: Clock,
      title: 'Flexible Scheduling',
      description: 'Booking windows open and close as per admin settings'
    },
    {
      icon: CreditCard,
      title: 'Pay After Trip',
      description: 'No upfront payment. Pay only after your trip is completed'
    },
    {
      icon: Users,
      title: 'Fair Cost Sharing',
      description: 'Trip cost divided equally among all participants'
    }
  ];

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl grid lg:grid-cols-2 gap-8 items-center">
        {/* Left Side - Features */}
        <div className="hidden lg:block space-y-8">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center">
                <Car className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Friday Cab</h1>
                <p className="text-slate-400">Management System</p>
              </div>
            </div>
            <p className="text-slate-400 text-lg">
              Seamless cab booking for IIT Kharagpur students for Friday prayer at the mosque.
            </p>
          </div>

          <div className="grid gap-4">
            {features.map((feature, index) => (
              <div key={index} className="flex items-start gap-4 p-4 rounded-lg bg-slate-900/50 border border-slate-800">
                <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center shrink-0">
                  <feature.icon className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-white font-medium">{feature.title}</h3>
                  <p className="text-slate-400 text-sm">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Side - Login Card */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center mb-4 lg:hidden">
              <Car className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-2xl text-white">Welcome Back</CardTitle>
            <CardDescription className="text-slate-400">
              Sign in with your IIT Kharagpur email
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Error Alert */}
            {error && (
              <Alert variant="destructive" className="bg-red-950/50 border-red-800 text-red-200">
                <AlertCircle className="h-4 w-4 text-red-400" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              onClick={handleSupabaseGoogleLogin}
              disabled={loading}
              className="w-full h-12 bg-white hover:bg-slate-100 text-slate-900 font-medium disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin mr-2" />
              ) : (
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
              )}
              Continue with Google
            </Button>

            {/* Alternative: Backend OAuth */}
            <div className="text-center">
              <span className="text-slate-500 text-sm">or</span>
            </div>

            <Button
              onClick={handleBackendGoogleLogin}
              variant="outline"
              className="w-full h-12 border-slate-700 text-white hover:bg-slate-800"
            >
              Login with Backend OAuth
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <Separator className="bg-slate-800" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-slate-900 px-2 text-slate-500">Requirements</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm text-slate-400">
                <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <Mail className="w-3 h-3 text-emerald-400" />
                </div>
                <span>Must use <strong className="text-emerald-400">@kgpian.iitkgp.ac.in</strong> email</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-400">
                <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <Shield className="w-3 h-3 text-emerald-400" />
                </div>
                <span>One account per student only</span>
              </div>
            </div>

            <div className="text-center text-xs text-slate-500">
              By signing in, you agree to our terms of service and privacy policy.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Login;
