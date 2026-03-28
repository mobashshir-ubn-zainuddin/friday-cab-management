import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Car } from 'lucide-react';

const AuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();

  useEffect(() => {
    const token = searchParams.get('token');
    const error = searchParams.get('error');

    if (error) {
      // Handle error
      let errorMessage = 'Authentication failed';
      switch (error) {
        case 'unauthorized':
          errorMessage = 'Only @kgpian.iitkgp.ac.in emails are allowed';
          break;
        case 'blocked':
          errorMessage = 'Your account has been blocked';
          break;
        default:
          errorMessage = 'Authentication failed. Please try again.';
      }
      navigate(`/login?error=${encodeURIComponent(errorMessage)}`);
      return;
    }

    if (token) {
      // Decode token to get user info (in production, fetch from API)
      try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const payload = JSON.parse(window.atob(base64));
        
        const userData = {
          id: payload.userId,
          email: payload.email,
          name: payload.name || payload.email.split('@')[0],
          isAdmin: !!payload.isAdmin,
          createdAt: new Date().toISOString()
        };

        login(token, userData);
        navigate('/dashboard');
      } catch (err) {
        console.error('Error decoding token:', err);
        navigate('/login?error=Invalid token');
      }
    } else {
      navigate('/login');
    }
  }, [searchParams, login, navigate]);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center mx-auto animate-pulse">
          <Car className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-xl font-semibold text-white">Authenticating...</h1>
        <p className="text-slate-400">Please wait while we verify your credentials</p>
      </div>
    </div>
  );
};

export default AuthCallback;
