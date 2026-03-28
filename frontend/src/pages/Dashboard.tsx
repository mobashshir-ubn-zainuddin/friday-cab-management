import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { userApi } from '@/services/api';
import type { UserDashboardStats } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Car,
  Ticket,
  CheckCircle,
  Calendar,
  CreditCard,
  IndianRupee,
  AlertTriangle,
  ArrowRight,
  Clock
} from 'lucide-react';

const Dashboard = () => {
  const { user, hasPendingPayments } = useAuth();
  const [stats, setStats] = useState<UserDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      const data = await userApi.getDashboardStats();
      setStats(data as UserDashboardStats);
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: 'Total Trips',
      value: stats?.totalTrips || 0,
      icon: Car,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
      link: '/my-bookings'
    },
    {
      title: 'Active Bookings',
      value: stats?.activeBookings || 0,
      icon: Ticket,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      link: '/my-bookings'
    },
    {
      title: 'Completed Trips',
      value: stats?.completedTrips || 0,
      icon: CheckCircle,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10',
      link: '/my-bookings'
    },
    {
      title: 'Upcoming Trips',
      value: stats?.upcomingTrips || 0,
      icon: Calendar,
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
      link: '/trips'
    },
    {
      title: 'Pending Payments',
      value: stats?.pendingPayments || 0,
      icon: CreditCard,
      color: 'text-red-400',
      bgColor: 'bg-red-500/10',
      link: '/payments'
    },
    {
      title: 'Total Spent',
      value: `₹${stats?.totalSpent?.toLocaleString() || 0}`,
      icon: IndianRupee,
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/10',
      link: '/payments'
    }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-400">Welcome back, {user?.name}</p>
        </div>
        <div className="flex gap-3">
          <Button asChild variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800">
            <Link to="/trips">
              <Car className="w-4 h-4 mr-2" />
              Browse Trips
            </Link>
          </Button>
          <Button asChild className="bg-emerald-500 hover:bg-emerald-600">
            <Link to="/my-bookings">
              <Ticket className="w-4 h-4 mr-2" />
              My Bookings
            </Link>
          </Button>
        </div>
      </div>

      {/* Pending Payment Alert */}
      {hasPendingPayments && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-red-400 font-medium">Payment Required</h3>
            <p className="text-red-300/80 text-sm mt-1">
              You have pending payments. Please clear your dues to book new trips.
            </p>
          </div>
          <Button asChild size="sm" variant="outline" className="border-red-500/30 text-red-400 hover:bg-red-500/10">
            <Link to="/payments">Pay Now</Link>
          </Button>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((stat) => (
          <Link key={stat.title} to={stat.link}>
            <Card className="bg-slate-900 border-slate-800 hover:border-slate-700 transition-colors cursor-pointer group">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className={`w-12 h-12 ${stat.bgColor} rounded-lg flex items-center justify-center`}>
                    <stat.icon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                  <ArrowRight className="w-5 h-5 text-slate-600 group-hover:text-slate-400 transition-colors" />
                </div>
                <div className="mt-4">
                  <p className="text-slate-400 text-sm">{stat.title}</p>
                  <p className="text-2xl font-bold text-white mt-1">{stat.value}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-emerald-400" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button asChild variant="outline" className="w-full justify-start border-slate-700 text-slate-300 hover:bg-slate-800">
              <Link to="/trips">
                <Car className="w-4 h-4 mr-3" />
                Book a New Trip
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-start border-slate-700 text-slate-300 hover:bg-slate-800">
              <Link to="/my-bookings">
                <Ticket className="w-4 h-4 mr-3" />
                View My Bookings
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-start border-slate-700 text-slate-300 hover:bg-slate-800">
              <Link to="/payments">
                <CreditCard className="w-4 h-4 mr-3" />
                Manage Payments
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-start border-slate-700 text-slate-300 hover:bg-slate-800">
              <Link to="/profile">
                <CheckCircle className="w-4 h-4 mr-3" />
                Update Profile
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Account Info */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              Account Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between py-2 border-b border-slate-800">
              <span className="text-slate-400">Email</span>
              <span className="text-white">{user?.email}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-slate-800">
              <span className="text-slate-400">Phone</span>
              <span className="text-white">{user?.phone || 'Not set'}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-slate-400">Status</span>
              <Badge variant="outline" className="border-emerald-500/30 text-emerald-400">
                Active
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
