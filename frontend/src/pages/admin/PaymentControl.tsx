import { useEffect, useState } from 'react';
import { adminApi, tripApi, paymentApi } from '@/services/api';
import type { Trip, Payment, User } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  Users,
  Eye,
  XCircle
} from 'lucide-react';
import { formatDateIST, formatDateTimeIST } from '@/utils/timezone';

interface Attendee {
  bookingId: string;
  user: User;
  attended: boolean;
  cabAssignment: {
    seatNumber?: number;
    cab?: {
      vehicleType: string;
      vehicleNumber: string;
    };
  } | null;
  payment: {
    id: string;
    amount: number;
    status: string;
    razorpayOrderId?: string;
    razorpayPaymentId?: string;
    paidAt?: string;
  } | null;
}

interface TripForPaymentControl {
  id: string;
  title: string;
  date: string;
  departureTime: string;
  status: string;
  totalCost: number | null;
  costPerPerson: number | null;
  paymentWindowOpen: boolean;
  paymentAssigned: boolean;
  paymentStatus: 'NOT_ASSIGNED' | 'PAYMENT_PENDING' | 'PAYMENT_COMPLETED';
  currentBookings: number;
  summary: {
    totalAttendees: number;
    paidCount: number;
    pendingCount: number;
    failedCount: number;
    noPaymentCount: number;
  };
}

interface TripBookingsData {
  trip: TripForPaymentControl;
  attendees: Attendee[];
  summary: {
    totalAttendees: number;
    paidCount: number;
    pendingCount: number;
    failedCount: number;
    noPaymentCount: number;
  };
}

const PaymentControl = () => {
  const [trips, setTrips] = useState<TripForPaymentControl[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTrip, setSelectedTrip] = useState<TripForPaymentControl | null>(null);
  const [totalCost, setTotalCost] = useState('');
  const [openingPayment, setOpeningPayment] = useState(false);
  const [tripAttendees, setTripAttendees] = useState<Attendee[]>([]);
  const [loadingAttendees, setLoadingAttendees] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const data = await adminApi.getTripsForPaymentControl();
      setTrips((data as any).trips || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load payment data');
    } finally {
      setLoading(false);
    }
  };

  const handleViewAttendees = async (trip: TripForPaymentControl) => {
    setSelectedTrip(trip);
    setLoadingAttendees(true);
    try {
      const data = await adminApi.getTripBookingsForPayment(trip.id);
      setTripAttendees((data as any).attendees || []);
    } catch (error) {
      console.error('Error fetching attendees:', error);
      toast.error('Failed to load attendees');
    } finally {
      setLoadingAttendees(false);
    }
  };

  const handleOpenPayment = async () => {
    if (!selectedTrip || !totalCost) return;

    setOpeningPayment(true);
    const tripId = selectedTrip.id;

    try {
      await tripApi.togglePaymentWindow(tripId, 'open', parseFloat(totalCost));
      toast.success('Payment window opened successfully');
      fetchData();
      setSelectedTrip(null);
      setTotalCost('');
    } catch (error: any) {
      const message = error.response?.data?.error || 'Failed to open payment window';
      toast.error(message);
    } finally {
      setOpeningPayment(false);
    }
  };

  const handleExportReport = async () => {
    try {
      const rawData = await paymentApi.exportReport();
      const data = (rawData || []) as any[];
      const formattedData = data.map(row => ({
        ...row,
        'Trip Date': row['Trip Date'] ? formatDateIST(row['Trip Date']) : '',
        'Paid At': row['Paid At'] ? formatDateTimeIST(row['Paid At']) : ''
      }));
      const csv = convertToCSV(formattedData);
      downloadCSV(csv, 'payments-report.csv');
      toast.success('Report downloaded successfully');
    } catch (error) {
      console.error('Error exporting report:', error);
      toast.error('Failed to export report');
    }
  };

  const convertToCSV = (data: any[]) => {
    if (!Array.isArray(data) || data.length === 0) return '';
    const headers = Object.keys(data[0]);
    const escapeCell = (val: any) => {
      const s = val === null || val === undefined ? '' : String(val);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    };
    const rows = data.map(row => headers.map(h => escapeCell(row[h])).join(','));
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

  const formatDate = (dateString: string) => formatDateIST(dateString) || '';

  const getPaymentStatusBadge = (status: 'NOT_ASSIGNED' | 'PAYMENT_PENDING' | 'PAYMENT_COMPLETED') => {
    const styles: Record<string, string> = {
      NOT_ASSIGNED: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
      PAYMENT_PENDING: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      PAYMENT_COMPLETED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    };
    const labels: Record<string, string> = {
      NOT_ASSIGNED: 'Not Assigned',
      PAYMENT_PENDING: 'Payment Pending',
      PAYMENT_COMPLETED: 'Payment Completed',
    };
    return (
      <Badge variant="outline" className={styles[status] || styles.NOT_ASSIGNED}>
        {labels[status] || status}
      </Badge>
    );
  };

  const getAttendeePaymentStatusBadge = (status: string | undefined) => {
    if (!status) return (
      <Badge variant="outline" className="bg-slate-500/10 text-slate-400 border-slate-500/30">
        No Payment
      </Badge>
    );
    const styles: Record<string, string> = {
      PENDING: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      PROCESSING: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
      COMPLETED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      FAILED: 'bg-red-500/10 text-red-400 border-red-500/30',
      REFUNDED: 'bg-slate-500/10 text-slate-400 border-slate-500/30'
    };
    const labels: Record<string, string> = {
      PENDING: 'Pending',
      PROCESSING: 'Processing',
      COMPLETED: 'Paid',
      FAILED: 'Failed',
      REFUNDED: 'Refunded'
    };
    return (
      <Badge variant="outline" className={styles[status] || styles.PENDING}>
        {labels[status] || status}
      </Badge>
    );
  };

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
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-500/10 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-slate-400 text-sm">Pending Payments</p>
                <p className="text-2xl font-bold text-white">
                  {trips.filter(t => t.paymentStatus === 'PAYMENT_PENDING').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-500/10 rounded-lg flex items-center justify-center">
                <IndianRupee className="w-5 h-5 text-slate-400" />
              </div>
              <div>
                <p className="text-slate-400 text-sm">Not Assigned</p>
                <p className="text-2xl font-bold text-white">
                  {trips.filter(t => t.paymentStatus === 'NOT_ASSIGNED').length}
                </p>
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
                <p className="text-slate-400 text-sm">Completed (Hidden)</p>
                <p className="text-2xl font-bold text-white">
                  {trips.filter(t => t.paymentStatus === 'PAYMENT_COMPLETED').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-slate-400 text-sm">Total Trips to Manage</p>
                <p className="text-2xl font-bold text-white">{trips.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Trips with Payment Control */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-white">Trip Payments</h2>
        <div className="grid gap-4">
          {trips.length === 0 ? (
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="p-12 text-center">
                <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CreditCard className="w-8 h-8 text-slate-500" />
                </div>
                <h3 className="text-white font-medium text-lg">No trips need payment management</h3>
                <p className="text-slate-400 mt-2">
                  All trips either have payments assigned and completed, or have no bookings.
                </p>
              </CardContent>
            </Card>
          ) : (
            trips.map((trip) => (
              <Card key={trip.id} className="bg-slate-900 border-slate-800">
                <CardContent className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="text-lg font-semibold text-white">{trip.title}</h3>
                        {getPaymentStatusBadge(trip.paymentStatus)}
                      </div>

                      <div className="flex items-center gap-4 mt-2 text-sm text-slate-400 flex-wrap">
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

                    <div className="flex items-center gap-2 flex-wrap">
                      {/* View Attendees button - always available */}
                      <Button
                        variant="outline"
                        onClick={() => handleViewAttendees(trip)}
                        className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View Attendees
                      </Button>

                      {/* Open Payment button - ONLY for NOT_ASSIGNED trips */}
                      {trip.paymentStatus === 'NOT_ASSIGNED' && (
                        <Button
                          onClick={() => { setSelectedTrip(trip); setTotalCost(''); }}
                          className="bg-emerald-500 hover:bg-emerald-600"
                        >
                          <LockOpen className="w-4 h-4 mr-2" />
                          Assign Payment
                        </Button>
                      )}

                      {/* For PAYMENT_PENDING trips, show status only - no close/reopen */}
                      {trip.paymentStatus === 'PAYMENT_PENDING' && (
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30">
                          <Clock className="w-3 h-3 mr-1" />
                          Awaiting Payments
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Attendees Dialog - READ ONLY */}
      <Dialog open={!!selectedTrip} onOpenChange={() => { setSelectedTrip(null); setTripAttendees([]); setTotalCost(''); }}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-4xl max-h-[85vh] flex flex-col p-0">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="text-xl flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-500" />
              {selectedTrip?.title} - Attendees & Payment Status
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {selectedTrip && formatDate(selectedTrip.date)} • {tripAttendees.length} attendee(s)
              {selectedTrip?.paymentStatus && (
                <span className="ml-4">
                  {' | '}
                  {getPaymentStatusBadge(selectedTrip.paymentStatus)}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 pt-0">
            {loadingAttendees ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-16 w-full bg-slate-800 rounded-lg" />
                ))}
              </div>
            ) : tripAttendees.length === 0 ? (
              <div className="text-center py-12 bg-slate-800/50 rounded-xl border border-dashed border-slate-700">
                <Users className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400">No eligible bookings found for this trip</p>
              </div>
            ) : (
              <div className="space-y-4">
                {tripAttendees.map((attendee) => (
                  <Card key={attendee.bookingId} className="bg-slate-900 border-slate-800">
                    <CardContent className="p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div>
                            <p className="text-white font-medium">{attendee.user.name}</p>
                            <p className="text-slate-400 text-sm">{attendee.user.email}</p>
                            {attendee.user.rollNumber && (
                              <p className="text-slate-500 text-xs">{attendee.user.rollNumber}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-slate-400">
                            {attendee.attended && (
                              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Attended
                              </Badge>
                            )}
                            {attendee.cabAssignment && (
                              <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30">
                                Seat: {attendee.cabAssignment.seatNumber} ({attendee.cabAssignment.cab?.vehicleType})
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-4 sm:ml-auto">
                          <div className="text-right">
                            {attendee.payment ? (
                              <>
                                <p className="text-xl font-bold text-white">₹{attendee.payment.amount}</p>
                                {getAttendeePaymentStatusBadge(attendee.payment.status)}
                              </>
                            ) : (
                              <span className="text-slate-500 text-sm">No payment record</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Dialog Footer - Only show payment assignment for NOT_ASSIGNED trips */}
          <DialogFooter className="p-4 border-t border-slate-800 bg-slate-900/50">
            {selectedTrip?.paymentStatus === 'NOT_ASSIGNED' && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 w-full">
                <div className="space-y-2 sm:space-y-0 sm:space-x-4 w-full sm:w-auto">
                  <Label className="text-sm">Total Trip Cost (₹)</Label>
                  <input
                    type="number"
                    value={totalCost}
                    onChange={(e) => setTotalCost(e.target.value)}
                    className="bg-slate-800 border-slate-700 text-white w-full sm:w-48 px-3 py-2 rounded-md"
                    placeholder="Enter total cost"
                  />
                </div>

                {totalCost && selectedTrip && (
                  <div className="p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20 flex items-center gap-4 text-sm">
                    <p className="text-emerald-400">Cost per person</p>
                    <p className="text-2xl font-bold text-emerald-400">
                      ₹{(parseFloat(totalCost) / (tripAttendees.length || 1)).toFixed(2)}
                    </p>
                    <p className="text-emerald-400/70 text-xs">
                      Divided among {tripAttendees.length} attendees
                    </p>
                  </div>
                )}

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Button
                    variant="outline"
                    onClick={() => { setSelectedTrip(null); setTripAttendees([]); setTotalCost(''); }}
                    className="border-slate-700 text-slate-300 hover:bg-slate-800"
                    disabled={openingPayment}
                  >
                    Close
                  </Button>
                  <Button
                    onClick={handleOpenPayment}
                    className="bg-emerald-500 hover:bg-emerald-600"
                    disabled={openingPayment || !totalCost || tripAttendees.length === 0}
                  >
                    {openingPayment ? 'Opening...' : 'Assign Payment'}
                  </Button>
                </div>
              </div>
            )}

            {selectedTrip?.paymentStatus === 'PAYMENT_PENDING' && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 w-full">
                <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/20 flex items-center gap-4 text-sm">
                  <Clock className="w-5 h-5 text-amber-400" />
                  <div>
                    <p className="text-amber-400 font-medium">Payment Pending</p>
                    <p className="text-amber-300/80 text-sm">
                      {selectedTrip.summary.pendingCount} of {selectedTrip.summary.totalAttendees} attendees yet to pay
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={() => { setSelectedTrip(null); setTripAttendees([]); }}
                  className="border-slate-700 text-slate-300 hover:bg-slate-800"
                >
                  Close
                </Button>
              </div>
            )}

            {selectedTrip?.paymentStatus === 'PAYMENT_COMPLETED' && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 w-full">
                <div className="p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20 flex items-center gap-4 text-sm">
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                  <div>
                    <p className="text-emerald-400 font-medium">Payment Completed</p>
                    <p className="text-emerald-300/80 text-sm">
                      All {selectedTrip.summary.totalAttendees} attendees have paid
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={() => { setSelectedTrip(null); setTripAttendees([]); }}
                  className="border-slate-700 text-slate-300 hover:bg-slate-800"
                >
                  Close
                </Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PaymentControl;