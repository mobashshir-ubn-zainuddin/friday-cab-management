import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { tripApi } from '@/services/api';
import type { Trip, TripStatus, EffectiveTripStatus } from '@/types';
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
  Plus,
  Calendar,
  Clock,
  Users,
  Car,
  Edit,
  Trash2,
  AlertTriangle,
  XCircle,
  ArrowRight
} from 'lucide-react';
import {
  formatShortDateIST,
  formatTimeIST,
  formatForDatetimeLocalIST,
  formatForDateInputIST
} from '@/utils/timezone';

const TripManagement = () => {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);
  const [deletingTrip, setDeletingTrip] = useState<Trip | null>(null);
  const [deletingTripId, setDeletingTripId] = useState<string | null>(null);
  const [viewingBookingsTrip, setViewingBookingsTrip] = useState<Trip | null>(null);
  const [tripBookings, setTripBookings] = useState<any[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [creatingTrip, setCreatingTrip] = useState(false);
  const [cancellingTrip, setCancellingTrip] = useState<Trip | null>(null);
  const [cancellingTripId, setCancellingTripId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: '',
    bookingStartTime: '',
    bookingEndTime: '',
    cancellationDeadline: '',
    departureTime: '',
    returnTime: '',
    maxBookings: 100
  });

  useEffect(() => {
    fetchTrips();
  }, []);

  const fetchTrips = async () => {
    try {
      const data = await tripApi.getAll();
      setTrips((data as any).trips);
    } catch (error) {
      console.error('Error fetching trips:', error);
      toast.error('Failed to load trips');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (creatingTrip) return;
    setCreatingTrip(true);
    try {
      const newTrip = await tripApi.create({
        ...formData,
        maxBookings: Number(formData.maxBookings)
      });
      // Optimistic update: add new trip to list
      setTrips(prev => [newTrip as any, ...prev]);
      toast.success('Trip created successfully');
      setCreateDialogOpen(false);
      resetForm();
    } catch (error: any) {
      const message = error.response?.data?.error || 'Failed to create trip';
      toast.error(message);
    } finally {
      setCreatingTrip(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingTrip) return;

    try {
      const updatedTrip = await tripApi.update(editingTrip.id, formData);
      // Optimistic update
      setTrips(prev => prev.map(trip => trip.id === editingTrip.id ? updatedTrip as any : trip));
      toast.success('Trip updated successfully');
      setEditingTrip(null);
      resetForm();
    } catch (error: any) {
      const message = error.response?.data?.error || 'Failed to update trip';
      toast.error(message);
    }
  };

  const handleDelete = async () => {
    if (!deletingTrip || deletingTripId) return;
    const tripId = deletingTrip.id;
    setDeletingTripId(tripId);
    // Optimistic update: remove from list
    setTrips(prev => prev.filter(trip => trip.id !== tripId));
    
    try {
      await tripApi.delete(tripId);
      toast.success('Trip deleted successfully');
      setDeletingTrip(null);
    } catch (error: any) {
      // Rollback on error - refetch
      fetchTrips();
      const message = error.response?.data?.error || 'Failed to delete trip';
      toast.error(message);
    } finally {
      setDeletingTripId(null);
    }
  };

  const handleCancel = async () => {
    if (!cancellingTrip || cancellingTripId) return;
    const tripId = cancellingTrip.id;
    setCancellingTripId(tripId);
    
    try {
      await tripApi.cancel(tripId);
      // Optimistic update: update the trip status locally
      setTrips(prev => prev.map(t => t.id === tripId ? { ...t, status: 'CANCELLED' as any } : t));
      toast.success('Trip cancelled successfully');
      setCancellingTrip(null);
    } catch (error: any) {
      const message = error.response?.data?.error || 'Failed to cancel trip';
      toast.error(message);
    } finally {
      setCancellingTripId(null);
    }
  };

  const handleViewBookings = async (trip: Trip) => {
    setViewingBookingsTrip(trip);
    setLoadingBookings(true);
    try {
      const data = await tripApi.getById(trip.id);
      setTripBookings((data as any).bookings || []);
    } catch (error) {
      console.error('Error fetching bookings:', error);
      toast.error('Failed to load bookings');
    } finally {
      setLoadingBookings(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      date: '',
      bookingStartTime: '',
      bookingEndTime: '',
      cancellationDeadline: '',
      departureTime: '',
      returnTime: '',
      maxBookings: 100
    });
  };

  const openEditDialog = (trip: Trip) => {
    setEditingTrip(trip);

    setFormData({
      title: trip.title,
      description: trip.description || '',
      date: formatForDateInputIST(trip.date) || '',
      bookingStartTime: formatForDatetimeLocalIST(trip.bookingStartTime) || '',
      bookingEndTime: formatForDatetimeLocalIST(trip.bookingEndTime) || '',
      cancellationDeadline: formatForDatetimeLocalIST(trip.cancellationDeadline || '') || '',
      departureTime: formatForDatetimeLocalIST(trip.departureTime) || '',
      returnTime: formatForDatetimeLocalIST(trip.returnTime || '') || '',
      maxBookings: trip.maxBookings
    });
  };

  const VALID_STATUSES: EffectiveTripStatus[] = ['UPCOMING', 'BOOKING_OPEN', 'BOOKING_CLOSED', 'CAB_ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

  function isValidEffectiveStatus(status: string): status is EffectiveTripStatus {
    return VALID_STATUSES.includes(status as EffectiveTripStatus);
  }

  const getStatusBadge = (status: EffectiveTripStatus | string) => {
    const safeStatus = isValidEffectiveStatus(status) ? status : 'UPCOMING';
    const styles: Record<EffectiveTripStatus, string> = {
      UPCOMING: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
      BOOKING_OPEN: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      BOOKING_CLOSED: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      CAB_ASSIGNED: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
      IN_PROGRESS: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
      COMPLETED: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
      CANCELLED: 'bg-red-500/10 text-red-400 border-red-500/30'
    };

    return (
      <Badge variant="outline" className={styles[safeStatus]}>
        {safeStatus.replace('_', ' ')}
      </Badge>
    );
  };

  const formatDate = (dateString: string) => formatShortDateIST(dateString) || '';
  const formatTime = (dateString: string) => formatTimeIST(dateString) || '';

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
          <h1 className="text-2xl font-bold text-white">Trip Management</h1>
          <p className="text-slate-400">Create and manage trips</p>
        </div>
        <Button 
          onClick={() => setCreateDialogOpen(true)}
          className="bg-amber-500 hover:bg-amber-600"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Trip
        </Button>
      </div>

      {/* Trips List */}
      <div className="grid gap-4">
{trips.map((trip) => {
          const effectiveStatus = trip.effectiveStatus || trip.status;
          return (
            <Card key={trip.id} className="bg-slate-900 border-slate-800">
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="text-lg font-semibold text-white">{trip.title}</h3>
                      {getStatusBadge(effectiveStatus)}
                    </div>
                    
                    <div className="flex items-center gap-4 mt-2 text-sm text-slate-400 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {formatDate(trip.date)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {formatTime(trip.departureTime)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {trip.currentBookings}/{trip.maxBookings}
                      </span>
                      <span className="flex items-center gap-1">
                        <Car className="w-4 h-4" />
                        {trip.cabs?.length || 0} vehicles
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      className="border-slate-700 text-slate-300 hover:bg-slate-800"
                    >
                      <Link to={`/admin/trips/${trip.id}/cabs`}>
                        <Car className="w-4 h-4 mr-1" />
                        Cabs
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewBookings(trip)}
                      className="border-slate-700 text-slate-300 hover:bg-slate-800"
                    >
                      <Users className="w-4 h-4 mr-1" />
                      Bookings
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(trip)}
                      className="border-slate-700 text-slate-300 hover:bg-slate-800"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    {effectiveStatus !== 'CANCELLED' && effectiveStatus !== 'COMPLETED' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCancellingTrip(trip)}
                        className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                        disabled={cancellingTripId === trip.id}
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        Cancel Trip
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeletingTrip(trip)}
                      className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
            </CardContent>
          </Card>
        );
      })}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog 
        open={createDialogOpen || !!editingTrip} 
        onOpenChange={() => {
          setCreateDialogOpen(false);
          setEditingTrip(null);
          resetForm();
        }}
      >
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTrip ? 'Edit Trip' : 'Create New Trip'}</DialogTitle>
            <DialogDescription className="text-slate-400">
              {editingTrip ? 'Update trip details' : 'Fill in the details to create a new trip'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="bg-slate-800 border-slate-700 text-white"
                placeholder="e.g., Friday Prayer Trip - March 28"
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="bg-slate-800 border-slate-700 text-white"
                placeholder="Optional description"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label>Max Bookings</Label>
                <Input
                  type="number"
                  value={formData.maxBookings}
                  onChange={(e) => setFormData({ ...formData, maxBookings: parseInt(e.target.value) })}
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Booking Opens</Label>
                <Input
                  type="datetime-local"
                  value={formData.bookingStartTime}
                  onChange={(e) => setFormData({ ...formData, bookingStartTime: e.target.value })}
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label>Booking Closes</Label>
                <Input
                  type="datetime-local"
                  value={formData.bookingEndTime}
                  onChange={(e) => setFormData({ ...formData, bookingEndTime: e.target.value })}
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Cancellation Deadline (Optional)</Label>
              <Input
                type="datetime-local"
                value={formData.cancellationDeadline}
                onChange={(e) => setFormData({ ...formData, cancellationDeadline: e.target.value })}
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Departure Time</Label>
                <Input
                  type="datetime-local"
                  value={formData.departureTime}
                  onChange={(e) => setFormData({ ...formData, departureTime: e.target.value })}
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label>Return Time (Optional)</Label>
                <Input
                  type="datetime-local"
                  value={formData.returnTime}
                  onChange={(e) => setFormData({ ...formData, returnTime: e.target.value })}
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateDialogOpen(false);
                setEditingTrip(null);
                resetForm();
              }}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
              disabled={creatingTrip}
            >
              Cancel
            </Button>
            <Button
              onClick={editingTrip ? handleUpdate : handleCreate}
              className="bg-amber-500 hover:bg-amber-600"
              disabled={creatingTrip}
            >
              {creatingTrip ? 'Creating...' : editingTrip ? 'Update Trip' : 'Create Trip'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deletingTrip} onOpenChange={() => setDeletingTrip(null)}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white">
          <DialogHeader>
            <DialogTitle>Delete Trip</DialogTitle>
            <DialogDescription className="text-slate-400">
              Are you sure you want to delete this trip? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeletingTrip(null)}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
              disabled={deletingTripId !== null}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              variant="destructive"
              disabled={deletingTripId !== null}
            >
              {deletingTripId ? 'Deleting...' : 'Delete Trip'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Trip Dialog */}
      <Dialog open={!!cancellingTrip} onOpenChange={() => setCancellingTrip(null)}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white">
          <DialogHeader>
            <DialogTitle>Cancel Trip</DialogTitle>
            <DialogDescription className="text-slate-400">
              Are you sure you want to cancel this trip? This action cannot be undone. Existing bookings will be cancelled.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCancellingTrip(null)}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
              disabled={cancellingTripId !== null}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCancel}
              variant="destructive"
              disabled={cancellingTripId !== null}
            >
              {cancellingTripId ? 'Cancelling...' : 'Cancel Trip'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Bookings Dialog */}
      <Dialog 
        open={!!viewingBookingsTrip} 
        onOpenChange={() => setViewingBookingsTrip(null)}
      >
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-4xl max-h-[85vh] flex flex-col p-0">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="text-xl flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-500" />
              Bookings for {viewingBookingsTrip?.title}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              List of students who have booked this trip
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 pt-0">
            {loadingBookings ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-16 w-full bg-slate-800 rounded-lg" />
                ))}
              </div>
            ) : tripBookings.length === 0 ? (
              <div className="text-center py-12 bg-slate-800/50 rounded-xl border border-dashed border-slate-700">
                <Users className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400">No bookings yet for this trip</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 text-sm">
                      <th className="py-3 px-4 font-medium">Student Name</th>
                      <th className="py-3 px-4 font-medium">Roll Number</th>
                      <th className="py-3 px-4 font-medium">Department</th>
                      <th className="py-3 px-4 font-medium">Phone</th>
                      <th className="py-3 px-4 font-medium">Email</th>
                      <th className="py-3 px-4 font-medium text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {tripBookings.map((booking) => (
                      <tr key={booking.id} className="text-slate-300 hover:bg-slate-800/30 transition-colors">
                        <td className="py-4 px-4 font-medium text-white">{booking.user?.name}</td>
                        <td className="py-4 px-4">{booking.user?.rollNumber || 'N/A'}</td>
                        <td className="py-4 px-4">{booking.user?.department || 'N/A'}</td>
                        <td className="py-4 px-4">{booking.user?.phone || 'N/A'}</td>
                        <td className="py-4 px-4 text-xs text-slate-500">{booking.user?.email}</td>
                        <td className="py-4 px-4 text-right">
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px] uppercase tracking-wider">
                            {booking.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <DialogFooter className="p-4 border-t border-slate-800 bg-slate-900/50">
            <Button 
              variant="outline" 
              onClick={() => setViewingBookingsTrip(null)}
              className="bg-slate-800 border-slate-700 text-white hover:bg-slate-700"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TripManagement;
