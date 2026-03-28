import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { authApi } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Car, Eye, EyeOff, Loader2 } from 'lucide-react';

const Register = () => {
  const { isAuthenticated, login: setAuthData } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [emailPrefix, setEmailPrefix] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [department, setDepartment] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !emailPrefix || !password || !confirmPassword || !rollNumber || !department || !phone) {
      toast.error('Please fill all fields');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      toast.error('Password must be at least 8 characters long');
      return;
    }

    // Roll number validation (e.g., 23MI3PE01)
    const rollRegex = /^[0-9]{2}[A-Z]{2}[0-9A-Z]{1,7}$/;
    if (!rollRegex.test(rollNumber.toUpperCase())) {
      toast.error('Invalid Roll Number format (e.g., 23MI3PE01)');
      return;
    }

    if (phone.length < 10) {
      toast.error('Phone number must be at least 10 digits');
      return;
    }

    setLoading(true);
    try {
      const response = await authApi.register({ 
        name, 
        emailPrefix, 
        password,
        rollNumber: rollNumber.toUpperCase(),
        department,
        phone
      });
      setAuthData(response.token, response.user);
      toast.success('Account created successfully');
      navigate('/dashboard');
    } catch (error: any) {
      console.error('Registration error:', error);
      toast.error(error.message || 'Failed to register. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-500 rounded-2xl mb-4">
            <Car className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Friday Cab</h1>
          <p className="text-slate-400 mt-2">Create your account to start booking</p>
        </div>

        <Card className="bg-slate-900 border-slate-800 shadow-xl">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-white">Register</CardTitle>
            <CardDescription className="text-slate-400">
              Sign up with your institute details
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleRegister}>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-slate-300">Full Name</Label>
                  <Input
                    id="name"
                    placeholder="Mobashshir Zainuddin"
                    className="bg-slate-800 border-slate-700 text-white focus-visible:ring-emerald-500"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-300">Institute Email Prefix</Label>
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

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="rollNumber" className="text-slate-300">Roll Number</Label>
                    <Input
                      id="rollNumber"
                      placeholder="23MI3PE01"
                      className="bg-slate-800 border-slate-700 text-white focus-visible:ring-emerald-500 uppercase"
                      value={rollNumber}
                      onChange={(e) => setRollNumber(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="department" className="text-slate-300">Department</Label>
                    <Input
                      id="department"
                      placeholder="e.g. Mining"
                      className="bg-slate-800 border-slate-700 text-white focus-visible:ring-emerald-500"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-slate-300">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="10-digit mobile number"
                    className="bg-slate-800 border-slate-700 text-white focus-visible:ring-emerald-500"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-slate-300">Create a password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className="bg-slate-800 border-slate-700 text-white pr-10 focus-visible:ring-emerald-500"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-slate-300">Re-enter password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    className="bg-slate-800 border-slate-700 text-white focus-visible:ring-emerald-500"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>
              
              <p className="text-[10px] text-slate-500 mt-2 leading-tight">
                * Password must be at least 8 characters long. Roll number should follow institute format (e.g., 23MI3PE01).
              </p>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4 pt-2">
              <Button 
                type="submit" 
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Account...
                  </>
                ) : (
                  'REGISTER'
                )}
              </Button>
              <div className="text-center text-sm text-slate-400">
                Already have an account?{' '}
                <Link to="/login" className="text-emerald-500 hover:text-emerald-400 font-medium">
                  Log In
                </Link>
              </div>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default Register;