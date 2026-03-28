import { useEffect, useState } from 'react';
import { paymentApi, adminApi, tripApi } from '@/services/api';
import type { Trip, Payment } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  CreditCard,
  IndianRupee,
  CheckCircle,
  Clock,
  AlertTriangle,
  Calendar,
  Download,
  Lock,
  LockOpen,
  Users
} from 'lucide-react';

const PaymentControl = () => {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [pendingPayments, setPendingPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [totalCost, setTotalCost] = useState('');
  const [openingPayment, setOpeningPayment] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const tripsData = await tripApi.getAll();
      const pendingData = await adminApi.getPendingPayments();
      
      // Show trips that are COMPLETED or IN_PROGRESS or have bookings
      setTrips((tripsData as any).trips.filter((t: any) => 
        t.status === 'COMPLETED' || 
        t.status === 'IN_PROGRESS' || 
        t.status === 'CAB_ASSIGNED' ||
        t.paymentWindowOpen
      ));
      setPendingPayments((pendingData as any).pendingPayments || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load payment data');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenPaymentWindow = async () => {
    if (!selectedTrip || !totalCost) return;

    setOpeningPayment(true);
    try {
      await tripApi.togglePaymentWindow(selectedTrip.id, 'open', parseFloat(totalCost));
      toast.success('Payment window opened successfully');
      setSelectedTrip(null);
      setTotalCost('');
      fetchData();
    } catch (error: any) {
      const message = error.response?.data?.error || 'Failed to open payment window';
      toast.error(message);
    } finally {
      setOpeningPayment(false);
    }
  };

  const handleClosePaymentWindow = async (trip: Trip) => {
    try {
      await tripApi.togglePaymentWindow(trip.id, 'close');
      toast.success('Payment window closed successfully');
      fetchData();
    } catch (error: any) {
      const message = error.response?.data?.error || 'Failed to close payment window';
      toast.error(message);
    }
  };

  const handleExportReport = async () => {
    try {
      const data = await paymentApi.exportReport();
      // Convert to CSV and download
      const csv = convertToCSV(data);
      downloadCSV(csv, 'payments-report.csv');
      toast.success('Report downloaded successfully');
    } catch (error) {
      console.error('Error exporting report:', error);
      toast.error('Failed to export report');
    }
  };

  const convertToCSV = (data: any[]) => {
    if (data.length === 0) return '';
    const headers = Object.keys(data[0]);
    const rows = data.map(row => headers.map(h => row[h]).join(','));
    return [headers.join(','), ...rows].join('\n');
  };

  const downloadCSV = (csv: string, filename: string) => {
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const completedPayments = pendingPayments.filter(p => p.status === 'COMPLETED');
  const totalPending = pendingPayments
    .filter(p => p.status === 'PENDING')
    .reduce((sum, p) => sum + p.amount, 0);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48 bg-slate-800" />
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
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
          <h1 className="text-2xl font-bold text-white">Payment Control</h1>
          <p className="text-slate-400">Manage trip payments and dues</p>
        </div>
        <Button 
          variant="outline"
          onClick={handleExportReport}
          className="border-slate-700 text-slate-300 hover:bg-slate-800"
        >
          <Download className="w-4 h-4 mr-2" />
          Export Report
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-500/10 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-slate-400 text-sm">Pending Payments</p>
                <p className="text-2xl font-bold text-white">{pendingPayments.filter(p => p.status === 'PENDING').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-500/10 rounded-lg flex items-center justify-center">
                <IndianRupee className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <p className="text-slate-400 text-sm">Total Pending</p>
                <p className="text-2xl font-bold text-white">₹{totalPending.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-slate-400 text-sm">Completed</p>
                <p className="text-2xl font-bold text-white">{completedPayments.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Trips with Payment Control */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-white">Trip Payments</h2>
        <div className="grid gap-4">
          {trips.map((trip) => (
            <Card key={trip.id} className="bg-slate-900 border-slate-800">
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold text-white">{trip.title}</h3>
                      {trip.paymentWindowOpen ? (
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                          <LockOpen className="w-3 h-3 mr-1" />
                          Open
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-slate-500/10 text-slate-400 border-slate-500/30">
                          <Lock className="w-3 h-3 mr-1" />
                          Closed
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-4 mt-2 text-sm text-slate-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {formatDate(trip.date)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {trip.currentBookings} bookings
                      </span>
                      {trip.costPerPerson && (
                        <span className="flex items-center gap-1">
                          <IndianRupee className="w-4 h-4" />
                          ₹{trip.costPerPerson}/person
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {!trip.paymentWindowOpen ? (
                      <Button
                        onClick={() => setSelectedTrip(trip)}
                        className="bg-emerald-500 hover:bg-emerald-600"
                      >
                        <LockOpen className="w-4 h-4 mr-2" />
                        Open Payment
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        onClick={() => handleClosePaymentWindow(trip)}
                        className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                      >
                        <Lock className="w-4 h-4 mr-2" />
                        Close Payment
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Pending Payments List */}
      {pendingPayments.filter(p => p.status === 'PENDING').length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Pending Payments</h2>
          <div className="grid gap-4">
            {pendingPayments
              .filter(p => p.status === 'PENDING')
              .map((payment) => (
                <Card key={payment.id} className="bg-slate-900 border-slate-800">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white font-medium">{payment.user?.name}</p>
                        <p className="text-slate-400 text-sm">{payment.trip?.title}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-white">₹{payment.amount}</p>
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30">
                          <Clock className="w-3 h-3 mr-1" />
                          Pending
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </div>
      )}

      {/* Open Payment Dialog */}
      <Dialog open={!!selectedTrip} onOpenChange={() => setSelectedTrip(null)}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white">
          <DialogHeader>
            <DialogTitle>Open Payment Window</DialogTitle>
            <DialogDescription className="text-slate-400">
              Enter the total trip cost to calculate per-person amount
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <p className="text-white font-medium">{selectedTrip?.title}</p>
              <p className="text-slate-400 text-sm">
                {selectedTrip && formatDate(selectedTrip.date)}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Total Trip Cost (₹)</Label>
              <Input
                type="number"
                value={totalCost}
                onChange={(e) => setTotalCost(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white"
                placeholder="Enter total cost"
              />
            </div>

            {totalCost && selectedTrip && (
              <div className="p-4 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                <p className="text-emerald-400 text-sm">Cost per person</p>
                <p className="text-2xl font-bold text-emerald-400">
                  ₹{(parseFloat(totalCost) / (selectedTrip as any).currentBookings).toFixed(2)}
                </p>
                <p className="text-emerald-400/70 text-xs mt-1">
                  Divided among {selectedTrip.currentBookings} bookings
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSelectedTrip(null);
                setTotalCost('');
              }}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
              disabled={openingPayment}
            >
              Cancel
            </Button>
            <Button
              onClick={handleOpenPaymentWindow}
              className="bg-emerald-500 hover:bg-emerald-600"
              disabled={openingPayment || !totalCost}
            >
              {openingPayment ? 'Opening...' : 'Calculate & Open Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PaymentControl;
