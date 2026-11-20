import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Car, Loader2, LogIn, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const Login = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [emailPrefix, setEmailPrefix] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailPrefix) {
      toast.error('Please enter your email prefix');
      return;
    }
    if (!password) {
      toast.error('Please enter your password');
      return;
    }

    const email = `${emailPrefix.toLowerCase().trim()}@kgpian.iitkgp.ac.in`;

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message?.toLowerCase().includes('invalid login credentials')) {
          toast.error('Invalid email or password. Please check your credentials.');
        } else if (error.message?.toLowerCase().includes('email not confirmed')) {
          toast.error('Your account is pending admin approval. Please wait for approval.');
        } else {
          toast.error(error.message || 'Login failed. Please try again.');
        }
        return;
      }

      toast.success('Logged in successfully!');
    } catch (error: any) {
      console.error('Login error:', error);
      toast.error(error.message || 'Failed to log in');
    } finally {
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
          <h1 className="text-3xl font-bold text-white">Cab Management</h1>
          <p className="text-slate-400 mt-2">Log in to your account</p>
        </div>

        <Card className="bg-slate-900 border-slate-800">
          <form onSubmit={handleLogin}>
            <CardHeader>
              <CardTitle className="text-2xl text-white">Log In</CardTitle>
              <CardDescription className="text-slate-400">
                Enter your institute email and password
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
                    disabled={loading}
                  />
                  <div className="bg-slate-800 border border-l-0 border-slate-700 text-slate-400 px-3 flex items-center rounded-r-md text-sm font-medium whitespace-nowrap">
                    @kgpian.iitkgp.ac.in
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-300">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    className="bg-slate-800 border-slate-700 text-white focus-visible:ring-emerald-500 pr-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11"
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <LogIn className="mr-2 h-4 w-4" />
                )}
                LOG IN
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
        </Card>
      </div>
    </div>
  );
};

export default Login;
