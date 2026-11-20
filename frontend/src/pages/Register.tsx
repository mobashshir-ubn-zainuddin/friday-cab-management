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
import { Car, CheckCircle2, Loader2, UserPlus, Eye, EyeOff } from 'lucide-react';
import { authApi } from '@/services/api';

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

const HALLS = [
  'Atal Bihari Vajpayee Hall (ABV)',
  'Azad Hall',
  'B. C. Roy Hall (BCR)',
  'B. R. Ambedkar Hall (BRH)',
  'Gokhale Hall',
  'Homi J. Bhabha Hall (HJB)',
  'Jagadish Chandra Bose Hall (JCB)',
  'Lala Lajpat Rai Hall (LLR)',
  'Lal Bahadur Shastri Hall (LBS)',
  'Madan Mohan Malviya Hall (MMM)',
  'Meghnad Saha Hall (MS)',
  'Nehru Hall',
  'Patel Hall',
  'Radha Krishnan Hall (RK)',
  'Rajendra Prasad Hall (RP)',
  'Sir Ashutosh Mukherjee Hall (SAM)',
  'Vidyasagar Hall (VS)',
  'Zakir Hussain Hall (ZH)',
];

const Register = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [emailPrefix, setEmailPrefix] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [department, setDepartment] = useState('');
  const [hall, setHall] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [registerLoading, setRegisterLoading] = useState(false);
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const [alreadyExisted, setAlreadyExisted] = useState(false);
  const [isPendingApproval, setIsPendingApproval] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!emailPrefix || !name || !phone || !rollNumber || !department || !hall || !password || !confirmPassword) {
      toast.error('Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setRegisterLoading(true);
    setAlreadyExisted(false);
    setIsPendingApproval(false);
    try {
      const signupResult = await authApi.signup({
        emailPrefix,
        name,
        phone,
        rollNumber,
        department,
        hall,
        password
      });

      const existing = !!signupResult?.alreadyExisted;
      setAlreadyExisted(existing);

      const needsApproval = signupResult.needsAdminApproval;

      if (needsApproval) {
        setRegistrationComplete(false);
        setIsPendingApproval(true);

        if (existing) {
          toast.success('Your registration is already awaiting admin verification.');
        } else {
          toast.success('Registration submitted! Your account is pending admin approval.');
        }
        return;
      }

      // Auto-approved user (admin)
      setRegistrationComplete(true);
      if (existing) {
        toast.success('An account with this email already exists. Please log in.');
      } else {
        toast.success('Registration complete! You can now log in with your email and password.');
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

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-500 rounded-2xl mb-4">
            <Car className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Cab Management System</h1>
          <p className="text-slate-400 mt-2">Create your account</p>
        </div>

        <Card className="bg-slate-900 border-slate-800 shadow-xl">
          {isPendingApproval ? (
            <>
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10">
                  <Loader2 className="h-8 w-8 text-amber-500 animate-spin" />
                </div>
                <CardTitle className="text-2xl text-white">Verification Pending</CardTitle>
                <CardDescription className="text-slate-400">
                  Your registration is pending admin verification. Once approved, you will receive an email and can log in with your email and password.
                </CardDescription>
              </CardHeader>
              <CardFooter className="flex flex-col space-y-4 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-slate-400 hover:text-white"
                  onClick={() => {
                    setIsPendingApproval(false);
                    setAlreadyExisted(false);
                  }}
                >
                  Use a different email
                </Button>
              </CardFooter>
            </>
          ) : registrationComplete ? (
            <>
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                </div>
                <CardTitle className="text-2xl text-white">
                  {alreadyExisted ? 'Account already exists' : 'Registration Complete!'}
                </CardTitle>
                <CardDescription className="text-slate-400">
                  {alreadyExisted
                    ? 'An account with this email is already registered. Please log in with your email and password.'
                    : 'Your account has been created. You can now log in with your email and password.'}
                </CardDescription>
              </CardHeader>
              <CardFooter className="flex flex-col space-y-4 pt-2">
                <Button
                  type="button"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                  onClick={() => navigate('/login')}
                >
                  Go to Login
                </Button>
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
                  <Label htmlFor="name" className="text-slate-300">Full Name <span className="text-red-400">*</span></Label>
                  <Input
                    id="name"
                    placeholder="e.g. Mobashshir Zainuddin"
                    className="bg-slate-800 border-slate-700 text-white focus-visible:ring-emerald-500"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={registerLoading}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-300">Institute Email <span className="text-red-400">*</span></Label>
                  <div className="flex">
                    <Input
                      id="email"
                      placeholder="e.g. mobo"
                      className="bg-slate-800 border-slate-700 text-white rounded-r-none focus-visible:ring-emerald-500"
                      value={emailPrefix}
                      onChange={(e) => setEmailPrefix(e.target.value)}
                      disabled={registerLoading}
                      required
                    />
                    <div className="bg-slate-800 border border-l-0 border-slate-700 text-slate-400 px-3 flex items-center rounded-r-md text-sm font-medium whitespace-nowrap">
                      @kgpian.iitkgp.ac.in
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-slate-300">Phone Number <span className="text-red-400">*</span></Label>
                  <Input
                    id="phone"
                    placeholder="e.g. 7481843499"
                    className="bg-slate-800 border-slate-700 text-white focus-visible:ring-emerald-500"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    disabled={registerLoading}
                    inputMode="tel"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rollNumber" className="text-slate-300">Roll Number <span className="text-red-400">*</span></Label>
                  <Input
                    id="rollNumber"
                    placeholder="e.g. 23M3PE01"
                    className="bg-slate-800 border-slate-700 text-white focus-visible:ring-emerald-500"
                    value={rollNumber}
                    onChange={(e) => setRollNumber(e.target.value)}
                    disabled={registerLoading}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="department" className="text-slate-300">Department <span className="text-red-400">*</span></Label>
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
                <div className="space-y-2">
                  <Label htmlFor="hall" className="text-slate-300">Hall of Residence <span className="text-red-400">*</span></Label>
                  <Select value={hall} onValueChange={setHall} disabled={registerLoading}>
                    <SelectTrigger
                      id="hall"
                      className="w-full bg-slate-800 border-slate-700 text-white focus-visible:ring-emerald-500"
                    >
                      <SelectValue placeholder="Select your hall" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-700 text-white max-h-80">
                      {HALLS.map((h) => (
                        <SelectItem
                          key={h}
                          value={h}
                          className="text-white focus:bg-emerald-600 focus:text-white"
                        >
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-slate-300">Password <span className="text-red-400">*</span></Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Minimum 6 characters"
                      className="bg-slate-800 border-slate-700 text-white focus-visible:ring-emerald-500 pr-10"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={registerLoading}
                      required
                      minLength={6}
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
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-slate-300">Confirm Password <span className="text-red-400">*</span></Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="Re-enter your password"
                      className="bg-slate-800 border-slate-700 text-white focus-visible:ring-emerald-500 pr-10"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={registerLoading}
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      tabIndex={-1}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {confirmPassword && password !== confirmPassword && (
                    <p className="text-red-400 text-xs">Passwords do not match</p>
                  )}
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
                  {registerLoading ? 'REGISTERING...' : 'REGISTER'}
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
