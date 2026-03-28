import { useEffect, useState } from 'react';
import { paymentApi } from '@/services/api';
import type { Payment, PaymentStatus } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  CreditCard,
  CheckCircle,
  Clock,
  AlertTriangle,
  Calendar,
  IndianRupee,
  ArrowRight,
  Receipt
} from 'lucide-react';

// Razorpay script loader
const loadRazorpayScript = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (document.getElementById('razorpay-script')) {
      resolve(true);
      return;
    }

    const script = document.createElement('script');
    script.id = 'razorpay-script';
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

const Payments = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingPayment, setProcessingPayment] = useState<string | null>(null);

  useEffect(() => {
    fetchPayments();
    loadRazorpayScript();
  }, []);

  const fetchPayments = async () => {
    try {
      const data = await paymentApi.getMyPayments();
      setPayments((data as any).payments);
    } catch (error) {
      console.error('Error fetching payments:', error);
      toast.error('Failed to load payments');
    } finally {
      setLoading(false);
    }
  };

  const handlePayNow = async (payment: Payment) => {
    setProcessingPayment(payment.id);
    
    try {
      // Create order
      const orderData = await paymentApi.createOrder(payment.tripId);
      
      // Initialize Razorpay
      const options = {
        key: (orderData as any).keyId,
        amount: (orderData as any).amount,
        currency: (orderData as any).currency,
        name: 'Friday Cab System',
        description: `Payment for ${payment.trip?.title}`,
        order_id: (orderData as any).orderId,
        config: {
          display: {
            blocks: {
              upi: {
                name: 'Pay via UPI',
                instruments: [
                  {
                    method: 'upi'
                  }
                ]
              }
            },
            sequence: ['block.upi'],
            preferences: {
              show_default_blocks: false
            }
          }
        },
        handler: async (response: any) => {
          try {
            // Verify payment
            await paymentApi.verify({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature
            });
            
            toast.success('Payment successful!');
            fetchPayments();
          } catch (error) {
            console.error('Payment verification failed:', error);
            toast.error('Payment verification failed. Please contact support.');
          }
        },
        prefill: {
          name: payment.trip?.title,
          email: '',
          contact: ''
        },
        theme: {
          color: '#10b981'
        },
        modal: {
          ondismiss: () => {
            setProcessingPayment(null);
          }
        }
      };

      const razorpay = new (window as any).Razorpay(options);
      razorpay.open();
    } catch (error: any) {
      const message = error.response?.data?.error || 'Failed to initiate payment';
      toast.error(message);
    } finally {
      setProcessingPayment(null);
    }
  };

  const getStatusBadge = (status: PaymentStatus) => {
    const styles: Record<PaymentStatus, string> = {
      PENDING: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      PROCESSING: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
      COMPLETED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      FAILED: 'bg-red-500/10 text-red-400 border-red-500/30',
      REFUNDED: 'bg-slate-500/10 text-slate-400 border-slate-500/30'
    };

    const labels: Record<PaymentStatus, string> = {
      PENDING: 'Pending',
      PROCESSING: 'Processing',
      COMPLETED: 'Completed',
      FAILED: 'Failed',
      REFUNDED: 'Refunded'
    };

    return (
      <Badge variant="outline" className={styles[status]}>
        {labels[status]}
      </Badge>
    );
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const pendingPayments = payments.filter(p => p.status === 'PENDING');
  const completedPayments = payments.filter(p => p.status === 'COMPLETED');
  const totalPending = pendingPayments.reduce((sum, p) => sum + p.amount, 0);
  const totalPaid = completedPayments.reduce((sum, p) => sum + p.amount, 0);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48 bg-slate-800" />
        <div className="grid gap-4">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-48 bg-slate-800" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Payments</h1>
        <p className="text-slate-400">Manage your trip payments</p>
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
                <p className="text-slate-400 text-sm">Pending</p>
                <p className="text-xl font-bold text-white">₹{totalPending.toLocaleString()}</p>
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
                <p className="text-slate-400 text-sm">Paid</p>
                <p className="text-xl font-bold text-white">₹{totalPaid.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                <Receipt className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-slate-400 text-sm">Total Payments</p>
                <p className="text-xl font-bold text-white">{payments.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Payments Alert */}
      {pendingPayments.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-amber-400 font-medium">Pending Payments</h3>
            <p className="text-amber-300/80 text-sm mt-1">
              You have {pendingPayments.length} pending payment(s). Please clear them to book new trips.
            </p>
          </div>
        </div>
      )}

      {/* Pending Payments Section */}
      {pendingPayments.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Pending Payments</h2>
          <div className="grid gap-4">
            {pendingPayments.map((payment) => (
              <PaymentCard 
                key={payment.id} 
                payment={payment} 
                onPay={() => handlePayNow(payment)}
                isProcessing={processingPayment === payment.id}
              />
            ))}
          </div>
        </div>
      )}

      {/* Payment History */}
      {completedPayments.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Payment History</h2>
          <div className="grid gap-4">
            {completedPayments.map((payment) => (
              <PaymentCard key={payment.id} payment={payment} />
            ))}
          </div>
        </div>
      )}

      {/* No Payments */}
      {payments.length === 0 && (
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-12 text-center">
            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <CreditCard className="w-8 h-8 text-slate-500" />
            </div>
            <h3 className="text-white font-medium text-lg">No payments yet</h3>
            <p className="text-slate-400 mt-2">Payments will appear here after you complete trips</p>
          </CardContent>
        </Card>
      )}
    </div>
  );

  function PaymentCard({ 
    payment, 
    onPay, 
    isProcessing 
  }: { 
    payment: Payment; 
    onPay?: () => void;
    isProcessing?: boolean;
  }) {
    return (
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold text-white">{payment.trip?.title}</h3>
                {getStatusBadge(payment.status)}
              </div>
              <div className="flex items-center gap-4 mt-2 text-sm text-slate-400">
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {formatDate(payment.trip?.date)}
                </span>
                {payment.paidAt && (
                  <span className="flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" />
                    Paid on {formatDate(payment.paidAt)}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-slate-400">Amount</p>
                <p className="text-2xl font-bold text-white">₹{payment.amount}</p>
              </div>
              
              {onPay && (
                <Button
                  onClick={onPay}
                  disabled={isProcessing}
                  className="bg-emerald-500 hover:bg-emerald-600"
                >
                  {isProcessing ? 'Processing...' : 'Pay Now'}
                  {!isProcessing && <ArrowRight className="w-4 h-4 ml-2" />}
                </Button>
              )}
            </div>
          </div>

          {payment.razorpayPaymentId && (
            <div className="mt-4 pt-4 border-t border-slate-800">
              <p className="text-sm text-slate-500">
                Transaction ID: <span className="text-slate-400">{payment.razorpayPaymentId}</span>
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }
};

export default Payments;
