import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Car, CheckCircle2, Loader2, Mail, UserPlus } from 'lucide-react';
import { authApi } from '@/services/api';
import { supabase } from '@/lib/supabase';

const CALLBACK_URL = `${window.location.origin}/auth/callback`;

const DEPARTMENTS = [
  'Aerospace Engineering',
  'Agricultural and Food Engineering',
  'Architecture and Regional Planning',
  'Biotechnology',
  'Chemical Engineering',
  'Chemistry',
  'Civil Engineering',
  'Computer Science and Engineering',
  'Electrical Engineering',
  'Electronics and Electrical Communication Engineering',
  'Energy Science and Engineering',
  'Environmental Science and Engineering',
  'Geology and Geophysics',
  'Humanities and Social Sciences',
  'Industrial and Systems Engineering',
  'Instrumentation Engineering',
  'Management Studies',
  'Manufacturing Science and Engineering',
  'Mathematics',
  'Mechanical Engineering',
  'Metallurgical and Materials Engineering',
  'Mining Engineering',
  'Ocean Engineering and Naval Architecture',
  'Physics',
  'Rajiv Gandhi School of Intellectual Property Law',
  'School of Bio-Science',
  'School of Education',
  'School of Medical Science and Technology',
  'Vinod Gupta School of Management',
  'Water Resources Engineering',
  'Other'
];

const Register = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [emailPrefix, setEmailPrefix] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [department, setDepartment] = useState('');

  const [registerLoading, setRegisterLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [alreadyExisted, setAlreadyExisted] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!emailPrefix || !name || !phone || !rollNumber || !department) {
      toast.error('Please fill in all fields');
      return;
    }

    setRegisterLoading(true);
    setAlreadyExisted(false);
    try {
      // Step 1: Save user details to backend database (or get existing user)
      const signupResult = await authApi.signup({
        emailPrefix,
        name,
        phone,
        rollNumber,
        department
      });

      const existing = !!signupResult?.alreadyExisted;
      setAlreadyExisted(existing);

      // Step 2: Trigger Supabase magic link to their email
      const email = `${emailPrefix.toLowerCase().trim()}@kgpian.iitkgp.ac.in`;
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: CALLBACK_URL,
        }
      });

      if (error) {
        toast.warning(`We couldn't send the email link: ${error.message}. Please try the Sign In page.`);
        navigate('/login');
        return;
      }

      setMagicLinkSent(true);
      if (existing) {
        toast.success('An account with this email already exists. A sign-in link has been sent.');
      } else {
        toast.success('Registration complete! Check your email for the sign-in link.');
      }
    } catch (error: any) {
      console.error('Register error:', error);
      const msg = error?.message || 'Failed to register. Please try again.';
      if (
        msg.toLowerCase().includes('404') ||
        msg.toLowerCase().includes('network') ||
        error?.code === 'ERR_NETWORK'
      ) {
        toast.error('Could not reach the server. Please ensure the backend is running.');
      } else {
        toast.error(msg);
      }
    } finally {
      setRegisterLoading(false);
    }
  };

  const sentEmail = `${emailPrefix.toLowerCase().trim()}@kgpian.iitkgp.ac.in`;

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-500 rounded-2xl mb-4">
            <Car className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Friday Cab</h1>
          <p className="text-slate-400 mt-2">{alreadyExisted && magicLinkSent ? 'Sign in to your account' : 'Create your account'}</p>
        </div>

        <Card className="bg-slate-900 border-slate-800 shadow-xl">
          {magicLinkSent ? (
            <>
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                </div>
                {alreadyExisted ? (
                  <>
                    <CardTitle className="text-2xl text-white">Account already exists</CardTitle>
                    <CardDescription className="text-slate-400">
                      An account with this email is already registered.
                      A secure sign-in link has been sent to{' '}
                      <span className="font-medium text-slate-200">{sentEmail}</span>.
                      Click the link to sign in, or use a different email to register a new account.
                    </CardDescription>
                  </>
                ) : (
                  <>
                    <CardTitle className="text-2xl text-white">Welcome aboard!</CardTitle>
                    <CardDescription className="text-slate-400">
                      Your profile has been saved. A secure sign-in link has been sent to{' '}
                      <span className="font-medium text-slate-200">{sentEmail}</span>.
                      Click the link to complete your registration and sign in.
                    </CardDescription>
                  </>
                )}
              </CardHeader>
              <CardFooter className="flex flex-col space-y-4 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-slate-400 hover:text-white"
                  onClick={() => {
                    setMagicLinkSent(false);
                    setAlreadyExisted(false);
                  }}
                >
                  Use a different email
                </Button>
                <div className="text-center text-sm text-slate-400">
                  {alreadyExisted ? (
                    <>
                      Want to sign in directly?{' '}
                      <Link to="/login" className="text-emerald-500 hover:text-emerald-400 font-medium">
                        Go to Sign In
                      </Link>
                    </>
                  ) : (
                    <>
                      Already have an account?{' '}
                      <Link to="/login" className="text-emerald-500 hover:text-emerald-400 font-medium">
                        Sign in
                      </Link>
                    </>
                  )}
                </div>
              </CardFooter>
            </>
          ) : (
            <form onSubmit={handleRegister}>
              <CardHeader>
                <CardTitle className="text-2xl text-white">Register</CardTitle>
                <CardDescription className="text-slate-400">
                  Fill in your details to create an account
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-slate-300">Full Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g. Mobashshir Zainuddin"
                    className="bg-slate-800 border-slate-700 text-white focus-visible:ring-emerald-500"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={registerLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-300">Institute Email</Label>
                  <div className="flex">
                    <Input
                      id="email"
                      placeholder="e.g. mobo"
                      className="bg-slate-800 border-slate-700 text-white rounded-r-none focus-visible:ring-emerald-500"
                      value={emailPrefix}
                      onChange={(e) => setEmailPrefix(e.target.value)}
                      disabled={registerLoading}
                    />
                    <div className="bg-slate-800 border border-l-0 border-slate-700 text-slate-400 px-3 flex items-center rounded-r-md text-sm font-medium whitespace-nowrap">
                      @kgpian.iitkgp.ac.in
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-slate-300">Phone Number</Label>
                  <Input
                    id="phone"
                    placeholder="e.g. 7481843499"
                    className="bg-slate-800 border-slate-700 text-white focus-visible:ring-emerald-500"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    disabled={registerLoading}
                    inputMode="tel"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rollNumber" className="text-slate-300">Roll Number</Label>
                  <Input
                    id="rollNumber"
                    placeholder="e.g. 23M3PE01"
                    className="bg-slate-800 border-slate-700 text-white focus-visible:ring-emerald-500"
                    value={rollNumber}
                    onChange={(e) => setRollNumber(e.target.value)}
                    disabled={registerLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="department" className="text-slate-300">Department</Label>
                  <Select value={department} onValueChange={setDepartment} disabled={registerLoading}>
                    <SelectTrigger
                      id="department"
                      className="w-full bg-slate-800 border-slate-700 text-white focus-visible:ring-emerald-500"
                    >
                      <SelectValue placeholder="Select your department" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-700 text-white max-h-80">
                      {DEPARTMENTS.map((dept) => (
                        <SelectItem
                          key={dept}
                          value={dept}
                          className="text-white focus:bg-emerald-600 focus:text-white"
                        >
                          {dept}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 mt-6"
                  disabled={registerLoading}
                >
                  {registerLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <UserPlus className="mr-2 h-4 w-4" />
                  )}
                  {registerLoading ? 'REGISTERING...' : 'REGISTER & SEND SIGN-IN LINK'}
                </Button>
              </CardContent>
              <CardFooter className="flex flex-col space-y-4 pt-2">
                <div className="text-center text-sm text-slate-400">
                  Already have an account?{' '}
                  <Link to="/login" className="text-emerald-500 hover:text-emerald-400 font-medium">
                    Sign in
                  </Link>
                </div>
                <div className="text-center text-xs text-slate-500">
                  By registering, you agree to our terms
                </div>
              </CardFooter>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Register;
