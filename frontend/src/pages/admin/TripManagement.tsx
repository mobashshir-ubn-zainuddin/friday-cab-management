import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { tripApi } from '@/services/api';
import type { Trip, TripStatus } from '@/types';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Plus,
  Calendar,
  Clock,
  Users,
  Car,
  Edit,
  Trash2,
  Play,
  Square,
  CreditCard,
  ArrowRight
} from 'lucide-react';

const TripManagement = () => {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);
  const [deletingTrip, setDeletingTrip] = useState<Trip | null>(null);
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
    try {
      await tripApi.create({
        ...formData,
        maxBookings: Number(formData.maxBookings)
      });
      toast.success('Trip created successfully');
      setCreateDialogOpen(false);
      resetForm();
      fetchTrips();
    } catch (error: any) {
      const message = error.response?.data?.error || 'Failed to create trip';
      toast.error(message);
    }
  };

  const handleUpdate = async () => {
    if (!editingTrip) return;

    try {
      await tripApi.update(editingTrip.id, formData);
      toast.success('Trip updated successfully');
      setEditingTrip(null);
      resetForm();
      fetchTrips();
    } catch (error: any) {
      const message = error.response?.data?.error || 'Failed to update trip';
      toast.error(message);
    }
  };

  const handleDelete = async () => {
    if (!deletingTrip) return;

    try {
      await tripApi.delete(deletingTrip.id);
      toast.success('Trip deleted successfully');
      setDeletingTrip(null);
      fetchTrips();
    } catch (error: any) {
      const message = error.response?.data?.error || 'Failed to delete trip';
      toast.error(message);
    }
  };

  const handleToggleBookingWindow = async (trip: Trip, action: 'open' | 'close') => {
    try {
      await tripApi.toggleBookingWindow(trip.id, action);
      toast.success(`Booking window ${action}ed successfully`);
      fetchTrips();
    } catch (error: any) {
      const message = error.response?.data?.error || `Failed to ${action} booking window`;
      toast.error(message);
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
      date: trip.date.split('T')[0],
      bookingStartTime: trip.bookingStartTime.slice(0, 16),
      bookingEndTime: trip.bookingEndTime.slice(0, 16),
      cancellationDeadline: trip.cancellationDeadline ? trip.cancellationDeadline.slice(0, 16) : '',
      departureTime: trip.departureTime.slice(0, 16),
      returnTime: trip.returnTime ? trip.returnTime.slice(0, 16) : '',
      maxBookings: trip.maxBookings
    });
  };

  const getStatusBadge = (status: TripStatus) => {
    const styles: Record<TripStatus, string> = {
      UPCOMING: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
      BOOKING_OPEN: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      BOOKING_CLOSED: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      CAB_ASSIGNED: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
      IN_PROGRESS: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
      COMPLETED: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
      CANCELLED: 'bg-red-500/10 text-red-400 border-red-500/30'
    };

    return (
      <Badge variant="outline" className={styles[status]}>
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit'
    });
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
        {trips.map((trip) => (
          <Card key={trip.id} className="bg-slate-900 border-slate-800">
            <CardContent className="p-6">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="text-lg font-semibold text-white">{trip.title}</h3>
                    {getStatusBadge(trip.status)}
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
                  {trip.status === 'BOOKING_OPEN' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleBookingWindow(trip, 'close')}
                      className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                    >
                      <Square className="w-4 h-4 mr-1" />
                      Close Booking
                    </Button>
                  )}
                  {trip.status === 'BOOKING_CLOSED' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleBookingWindow(trip, 'open')}
                      className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                    >
                      <Play className="w-4 h-4 mr-1" />
                      Open Booking
                    </Button>
                  )}
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
                    onClick={() => openEditDialog(trip)}
                    className="border-slate-700 text-slate-300 hover:bg-slate-800"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
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
        ))}
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
            >
              Cancel
            </Button>
            <Button
              onClick={editingTrip ? handleUpdate : handleCreate}
              className="bg-amber-500 hover:bg-amber-600"
            >
              {editingTrip ? 'Update Trip' : 'Create Trip'}
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
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              variant="destructive"
            >
              Delete Trip
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TripManagement;
