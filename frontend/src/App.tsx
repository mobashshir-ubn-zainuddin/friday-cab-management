import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { Toaster } from '@/components/ui/sonner';

// Layouts
import MainLayout from '@/components/layouts/MainLayout';
import AdminLayout from '@/components/layouts/AdminLayout';

// Pages
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import AuthCallback from '@/pages/SupabaseAuthCallback';
import Dashboard from '@/pages/Dashboard';
import Trips from '@/pages/Trips';
import TripDetails from '@/pages/TripDetails';
import MyBookings from '@/pages/MyBookings';
import Payments from '@/pages/Payments';
import Profile from '@/pages/Profile';

// Admin Pages
import AdminDashboard from '@/pages/admin/AdminDashboard';
import TripManagement from '@/pages/admin/TripManagement';
import CabAllocation from '@/pages/admin/CabAllocation';
import PaymentControl from '@/pages/admin/PaymentControl';
import UserManagement from '@/pages/admin/UserManagement';
import Analytics from '@/pages/admin/Analytics';

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode; adminOnly?: boolean }> = ({ 
  children, 
  adminOnly = false 
}) => {
  const { isAuthenticated, isAdmin, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto mb-4"></div>
          <p className="text-emerald-500 text-lg">Loading Friday Cab System...</p>
          <p className="text-gray-400 text-sm mt-2">If this takes too long, try refreshing the page</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

function App() {
  return (
    <AuthProvider>
      <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/auth/callback" element={<AuthCallback />} />

          {/* Protected User Routes */}
          <Route path="/" element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="trips" element={<Trips />} />
            <Route path="trips/:id" element={<TripDetails />} />
            <Route path="my-bookings" element={<MyBookings />} />
            <Route path="payments" element={<Payments />} />
            <Route path="profile" element={<Profile />} />
          </Route>

          {/* Protected Admin Routes */}
          <Route path="/admin" element={
            <ProtectedRoute adminOnly>
              <AdminLayout />
            </ProtectedRoute>
          }>
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="trips" element={<TripManagement />} />
            <Route path="trips/:id/cabs" element={<CabAllocation />} />
            <Route path="payments" element={<PaymentControl />} />
            <Route path="users" element={<UserManagement />} />
            <Route path="analytics" element={<Analytics />} />
          </Route>

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      <Toaster position="top-right" richColors />
    </AuthProvider>
  );
}

export default App;
