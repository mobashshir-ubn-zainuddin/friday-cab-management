import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '@/services/api';
import type { AdminDashboardStats } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Users,
  Ticket,
  IndianRupee,
  Car,
  CreditCard,
  Calendar,
  TrendingUp,
  ArrowRight,
  Plus
} from 'lucide-react';

const AdminDashboard = () => {
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      const data = await adminApi.getDashboardStats();
      setStats(data as AdminDashboardStats);
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: 'Total Users',
      value: stats?.totalUsers || 0,
      icon: Users,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
      link: '/admin/users'
    },
    {
      title: 'Total Bookings',
      value: stats?.totalBookings || 0,
      icon: Ticket,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      link: '/admin/trips'
    },
    {
      title: 'Total Revenue',
      value: `₹${(stats?.totalRevenue || 0).toLocaleString()}`,
      icon: IndianRupee,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10',
      link: '/admin/analytics'
    },
    {
      title: 'Active Trips',
      value: stats?.activeTrips || 0,
      icon: Car,
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
      link: '/admin/trips'
    },
    {
      title: 'Pending Payments',
      value: stats?.pendingPayments || 0,
      icon: CreditCard,
      color: 'text-red-400',
      bgColor: 'bg-red-500/10',
      link: '/admin/payments'
    },
    {
      title: "Today's Bookings",
      value: stats?.todayBookings || 0,
      icon: Calendar,
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/10',
      link: '/admin/trips'
    }
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48 bg-slate-800" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-32 bg-slate-800" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
          <p className="text-slate-400">Manage your cab booking system</p>
        </div>
        <Button asChild className="bg-amber-500 hover:bg-amber-600">
          <Link to="/admin/trips">
            <Plus className="w-4 h-4 mr-2" />
            Create Trip
          </Link>
        </Button>
      </div>

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
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-amber-400" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button asChild variant="outline" className="w-full justify-start border-slate-700 text-slate-300 hover:bg-slate-800">
              <Link to="/admin/trips">
                <Calendar className="w-4 h-4 mr-3" />
                Manage Trips
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-start border-slate-700 text-slate-300 hover:bg-slate-800">
              <Link to="/admin/payments">
                <CreditCard className="w-4 h-4 mr-3" />
                Payment Control
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-start border-slate-700 text-slate-300 hover:bg-slate-800">
              <Link to="/admin/users">
                <Users className="w-4 h-4 mr-3" />
                User Management
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-start border-slate-700 text-slate-300 hover:bg-slate-800">
              <Link to="/admin/analytics">
                <TrendingUp className="w-4 h-4 mr-3" />
                View Analytics
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <IndianRupee className="w-5 h-5 text-amber-400" />
              Revenue Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between py-2 border-b border-slate-800">
              <span className="text-slate-400">Monthly Revenue</span>
              <span className="text-white font-medium">₹{stats?.monthlyRevenue?.toLocaleString() || 0}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-slate-800">
              <span className="text-slate-400">Total Revenue</span>
              <span className="text-white font-medium">₹{stats?.totalRevenue?.toLocaleString() || 0}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-slate-400">Pending Payments</span>
              <span className="text-red-400 font-medium">{stats?.pendingPayments || 0}</span>
            </div>
            <Button asChild variant="outline" className="w-full border-slate-700 text-slate-300 hover:bg-slate-800">
              <Link to="/admin/analytics">
                View Detailed Analytics
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;
