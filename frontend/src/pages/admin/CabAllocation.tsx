import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { adminApi, tripApi, bookingApi } from '@/services/api';
import type { Trip, Cab, Booking, VehicleType } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  ArrowLeft,
  Car,
  Plus,
  Users,
  CheckCircle,
  XCircle,
  Trash2,
  MapPin,
  User,
  Phone,
  Wand2
} from 'lucide-react';

const CabAllocation = () => {
  const { id: tripId } = useParams<{ id: string }>();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [cabs, setCabs] = useState<Cab[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [createCabOpen, setCreateCabOpen] = useState(false);
  const [deletingCab, setDeletingCab] = useState<Cab | null>(null);
  const [assigningBooking, setAssigningBooking] = useState<Booking | null>(null);
  const [viewingAssignment, setViewingAssignment] = useState<any | null>(null);
  const [markingPresence, setMarkingPresence] = useState(false);
  const [autoAssigning, setAutoAssigning] = useState(false);

  const [cabForm, setCabForm] = useState({
    vehicleType: 'CAB' as VehicleType,
    vehicleNumber: '',
    driverName: '',
    driverPhone: '',
    maxCapacity: 7
  });

  useEffect(() => {
    if (tripId) {
      fetchTripData();
    }
  }, [tripId]);

  const fetchTripData = async () => {
    try {
      const [tripData, cabsData] = await Promise.all([
        tripApi.getById(tripId!),
        adminApi.getCabs(tripId!)
      ]);
      setTrip(tripData as Trip);
      setCabs(cabsData as Cab[]);
      setBookings((tripData as any).bookings || []);
    } catch (error) {
      console.error('Error fetching trip data:', error);
      toast.error('Failed to load trip data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCab = async () => {
    try {
      await adminApi.createCab({
        tripId: tripId!,
        ...cabForm
      });
      toast.success('Cab added successfully');
      setCreateCabOpen(false);
      resetCabForm();
      fetchTripData();
    } catch (error: any) {
      const message = error.response?.data?.error || 'Failed to add cab';
      toast.error(message);
    }
  };

  const handleDeleteCab = async () => {
    if (!deletingCab) return;

    try {
      await adminApi.deleteCab(deletingCab.id);
      toast.success('Cab deleted successfully');
      setDeletingCab(null);
      fetchTripData();
    } catch (error: any) {
      const message = error.response?.data?.error || 'Failed to delete cab';
      toast.error(message);
    }
  };

  const handleAutoAssign = async () => {
    setAutoAssigning(true);
    try {
      await adminApi.autoAssignCabs(tripId!);
      toast.success('Cabs auto-assigned successfully');
      fetchTripData();
    } catch (error: any) {
      const message = error.response?.data?.error || 'Failed to auto-assign cabs';
      toast.error(message);
    } finally {
      setAutoAssigning(false);
    }
  };

  const handleManualAssign = async (cabId: string) => {
    if (!assigningBooking) return;

    try {
      await adminApi.assignCab({
        cabId,
        bookingId: assigningBooking.id
      });
      toast.success('Booking assigned successfully');
      setAssigningBooking(null);
      fetchTripData();
    } catch (error: any) {
      const message = error.response?.data?.error || 'Failed to assign booking';
      toast.error(message);
    }
  };

  const handleMarkPresence = async (bookingId: string, attended: boolean) => {
    setMarkingPresence(true);
    try {
      await bookingApi.markAttendance(bookingId, attended);
      toast.success(`Presence confirmed: ${attended ? 'Present' : 'Absent'}`);
      setViewingAssignment(null);
      fetchTripData();
    } catch (error: any) {
      const message = error.response?.data?.error || 'Failed to mark attendance';
      toast.error(message);
    } finally {
      setMarkingPresence(false);
    }
  };

  const resetCabForm = () => {
    setCabForm({
      vehicleType: 'CAB',
      vehicleNumber: '',
      driverName: '',
      driverPhone: '',
      maxCapacity: 7
    });
  };

  const getVehicleCapacity = (type: VehicleType) => {
    switch (type) {
      case 'CAB': return 7;
      case 'AUTO': return 10;
      case 'TOTO': return 5;
      default: return 7;
    }
  };

  const unassignedBookings = bookings.filter(b => 
    b.status === 'CONFIRMED' && !b.cabAssignment
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48 bg-slate-800" />
        <Skeleton className="h-64 bg-slate-800" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" asChild className="text-slate-400 hover:text-white">
            <Link to="/admin/trips">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-white">Cab Allocation</h1>
            <p className="text-slate-400">{trip?.title}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleAutoAssign}
            disabled={autoAssigning || unassignedBookings.length === 0}
            className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
          >
            <Wand2 className="w-4 h-4 mr-2" />
            {autoAssigning ? 'Assigning...' : 'Auto Assign'}
          </Button>
          <Button 
            onClick={() => setCreateCabOpen(true)}
            className="bg-amber-500 hover:bg-amber-600"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Vehicle
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4">
            <p className="text-slate-400 text-sm">Total Vehicles</p>
            <p className="text-2xl font-bold text-white">{cabs.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4">
            <p className="text-slate-400 text-sm">Total Bookings</p>
            <p className="text-2xl font-bold text-white">{bookings.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4">
            <p className="text-slate-400 text-sm">Unassigned</p>
            <p className="text-2xl font-bold text-amber-400">{unassignedBookings.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Cabs List */}
      <div className="grid gap-4">
        {cabs.map((cab) => (
          <Card key={cab.id} className="bg-slate-900 border-slate-800">
            <CardContent className="p-6">
              <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                {/* Cab Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                      <Car className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">
                        {cab.vehicleType} - {cab.vehicleNumber}
                      </h3>
                      <p className="text-slate-400 text-sm">
                        Capacity: {cab.currentOccupancy} / {cab.maxCapacity}
                      </p>
                    </div>
                  </div>

                  {cab.driverName && (
                    <div className="flex items-center gap-2 mt-3 text-sm text-slate-400">
                      <User className="w-4 h-4" />
                      {cab.driverName}
                      {cab.driverPhone && (
                        <>
                          <span className="mx-2">|</span>
                          <Phone className="w-4 h-4" />
                          {cab.driverPhone}
                        </>
                      )}
                    </div>
                  )}

                    <div className="mt-4">
                      <h4 className="text-sm font-medium text-white mb-2">Passengers</h4>
                      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {cab.assignments.map((assignment) => (
                          <button 
                            key={assignment.id} 
                            onClick={() => setViewingAssignment(assignment)}
                            className={`flex items-center gap-2 p-2 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors w-full text-left group ${
                              (assignment.booking as any)?.attended ? 'ring-1 ring-emerald-500/50' : ''
                            }`}
                          >
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center ${(assignment.booking as any)?.attended ? 'bg-emerald-500' : 'bg-emerald-500/20'}`}>
                              <span className={`text-xs ${(assignment.booking as any)?.attended ? 'text-white' : 'text-emerald-400'}`}>
                                {assignment.seatNumber}
                              </span>
                            </div>
                            <span className={`text-sm truncate flex-1 ${(assignment.booking as any)?.attended ? 'text-emerald-400 font-medium' : 'text-slate-300'}`}>
                              {assignment.user?.name}
                            </span>
                            {(assignment.booking as any)?.attended && (
                              <CheckCircle className="w-3 h-3 text-emerald-500" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {cab.currentOccupancy < cab.maxCapacity && unassignedBookings.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAssigningBooking(unassignedBookings[0])}
                      className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add Passenger
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeletingCab(cab)}
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

      {/* Unassigned Bookings */}
      {unassignedBookings.length > 0 && (
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-400" />
              Unassigned Bookings ({unassignedBookings.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {unassignedBookings.map((booking) => (
                <div 
                  key={booking.id} 
                  className="flex items-center justify-between p-3 bg-slate-800 rounded-lg"
                >
                  <div>
                    <p className="text-white font-medium">{booking.user?.name}</p>
                    <p className="text-slate-400 text-sm">{booking.user?.rollNumber}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setAssigningBooking(booking)}
                    className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                  >
                    Assign
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Cab Dialog */}
      <Dialog open={createCabOpen} onOpenChange={setCreateCabOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white">
          <DialogHeader>
            <DialogTitle>Add Vehicle</DialogTitle>
            <DialogDescription className="text-slate-400">
              Add a new vehicle for this trip
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Vehicle Type</Label>
              <Select
                value={cabForm.vehicleType}
                onValueChange={(value: VehicleType) => {
                  setCabForm({ 
                    ...cabForm, 
                    vehicleType: value,
                    maxCapacity: getVehicleCapacity(value)
                  });
                }}
              >
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="CAB">Cab (Max 7)</SelectItem>
                  <SelectItem value="AUTO">Auto (Max 10)</SelectItem>
                  <SelectItem value="TOTO">Toto (Max 5)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Vehicle Number</Label>
              <Input
                value={cabForm.vehicleNumber}
                onChange={(e) => setCabForm({ ...cabForm, vehicleNumber: e.target.value })}
                className="bg-slate-800 border-slate-700 text-white"
                placeholder="e.g., WB-02-AB-1234"
              />
            </div>

            <div className="space-y-2">
              <Label>Driver Name (Optional)</Label>
              <Input
                value={cabForm.driverName}
                onChange={(e) => setCabForm({ ...cabForm, driverName: e.target.value })}
                className="bg-slate-800 border-slate-700 text-white"
                placeholder="Driver name"
              />
            </div>

            <div className="space-y-2">
              <Label>Driver Phone (Optional)</Label>
              <Input
                value={cabForm.driverPhone}
                onChange={(e) => setCabForm({ ...cabForm, driverPhone: e.target.value })}
                className="bg-slate-800 border-slate-700 text-white"
                placeholder="Phone number"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateCabOpen(false);
                resetCabForm();
              }}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateCab}
              className="bg-amber-500 hover:bg-amber-600"
            >
              Add Vehicle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Cab Dialog */}
      <Dialog open={!!deletingCab} onOpenChange={() => setDeletingCab(null)}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white">
          <DialogHeader>
            <DialogTitle>Delete Vehicle</DialogTitle>
            <DialogDescription className="text-slate-400">
              Are you sure you want to delete this vehicle?
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeletingCab(null)}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteCab}
              variant="destructive"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Booking Dialog */}
      <Dialog open={!!assigningBooking} onOpenChange={() => setAssigningBooking(null)}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white">
          <DialogHeader>
            <DialogTitle>Assign to Cab</DialogTitle>
            <DialogDescription className="text-slate-400">
              Select a cab to assign {assigningBooking?.user?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-4">
            {cabs.filter(c => c.currentOccupancy < c.maxCapacity).map((cab) => (
              <Button
                key={cab.id}
                variant="outline"
                onClick={() => handleManualAssign(cab.id)}
                className="w-full justify-start border-slate-700 text-slate-300 hover:bg-slate-800"
              >
                <Car className="w-4 h-4 mr-2" />
                {cab.vehicleType} - {cab.vehicleNumber}
                <span className="ml-auto text-slate-500">
                  {cab.currentOccupancy}/{cab.maxCapacity}
                </span>
              </Button>
            ))}
            {cabs.filter(c => c.currentOccupancy < c.maxCapacity).length === 0 && (
              <p className="text-slate-400 text-center py-4">No available cabs</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Passenger Details & Presence Confirmation Dialog */}
      <Dialog open={!!viewingAssignment} onOpenChange={() => setViewingAssignment(null)}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-emerald-500" />
              Passenger Details
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Seat #{viewingAssignment?.seatNumber}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="bg-slate-800/50 p-4 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">Full Name</span>
                <span className="text-white font-medium">{viewingAssignment?.user?.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">Roll Number</span>
                <span className="text-white font-medium uppercase">{viewingAssignment?.user?.rollNumber || 'N/A'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">Email Address</span>
                <span className="text-white font-medium text-sm">{viewingAssignment?.user?.email}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">Phone Number</span>
                <span className="text-white font-medium">{viewingAssignment?.user?.phone || 'N/A'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">Department</span>
                <span className="text-white font-medium">{viewingAssignment?.user?.department || 'N/A'}</span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-700">
                <span className="text-slate-400 text-sm">Status</span>
                <Badge 
                  variant="outline" 
                  className={(viewingAssignment?.booking as any)?.attended 
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" 
                    : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                  }
                >
                  {(viewingAssignment?.booking as any)?.attended ? 'Attended' : 'Confirmed'}
                </Badge>
              </div>
            </div>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            {(viewingAssignment?.booking as any)?.attended ? (
              <Button
                variant="outline"
                className="w-full border-red-500/30 text-red-400 hover:bg-red-500/10"
                onClick={() => handleMarkPresence(viewingAssignment.bookingId, false)}
                disabled={markingPresence}
              >
                <XCircle className="w-4 h-4 mr-2" />
                Cancel Presence
              </Button>
            ) : (
              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                onClick={() => handleMarkPresence(viewingAssignment.bookingId, true)}
                disabled={markingPresence}
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Confirm Presence
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => setViewingAssignment(null)}
              className="w-full border-slate-700 text-slate-300 hover:bg-slate-800"
              disabled={markingPresence}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CabAllocation;
