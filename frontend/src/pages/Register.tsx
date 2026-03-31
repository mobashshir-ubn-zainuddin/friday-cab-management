import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Car, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Register = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-500 rounded-2xl mb-4">
            <Car className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Friday Cab</h1>
          <p className="text-slate-400 mt-2">Registration is now simplified</p>
        </div>

        <Card className="bg-slate-900 border-slate-800 shadow-xl">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl text-white">Simplified Access</CardTitle>
            <CardDescription className="text-slate-400">
              We now use Supabase for secure, passwordless authentication.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 text-center text-slate-300">
            <p>
              You no longer need to fill out a long registration form. 
              Just use your institute email to log in directly via OTP or Google.
            </p>
            <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 text-sm text-left space-y-2">
              <p className="font-medium text-emerald-400">How it works:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Go to the login page</li>
                <li>Enter your @kgpian.iitkgp.ac.in email</li>
                <li>Verify via OTP sent to your email or use Google</li>
                <li>Your profile will be created automatically!</li>
              </ul>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button asChild className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11">
              <Link to="/login">
                <Mail className="mr-2 h-4 w-4" />
                GO TO LOGIN
              </Link>
            </Button>
            <div className="text-center text-sm text-slate-400">
              Already have an account?{' '}
              <Link to="/login" className="text-emerald-500 hover:text-emerald-400 font-medium">
                Log In
              </Link>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default Register;
