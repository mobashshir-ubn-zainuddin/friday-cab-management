import { useEffect, useState } from 'react';
import { userApi } from '@/services/api';
import type { User } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Users,
  Search,
  Shield,
  UserX,
  UserCheck,
  Mail,
  IdCard,
  Ticket,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { formatDateIST } from '@/utils/timezone';
import { Label } from '@/components/ui/label';

const UserManagement = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [actionType, setActionType] = useState<'block' | 'admin' | 'approve' | 'reject' | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    fetchUsers();
  }, [page, search]);

  const fetchUsers = async () => {
    try {
      const data = await userApi.getAllUsers({
        page: page,
        limit: 10,
        search: search || undefined
      });
      setUsers((data as any).users);
      setTotalPages((data as any).pagination.totalPages);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleBlockUser = async () => {
    if (!selectedUser) return;

    try {
      await userApi.blockUser(selectedUser.id, !selectedUser.isBlocked);
      toast.success(`User ${selectedUser.isBlocked ? 'unblocked' : 'blocked'} successfully`);
      setSelectedUser(null);
      setActionType(null);
      fetchUsers();
    } catch (error: any) {
      const message = error.response?.data?.error || 'Failed to update user';
      toast.error(message);
    }
  };

  const handleSetAdmin = async () => {
    if (!selectedUser) return;

    try {
      await userApi.setAdmin(selectedUser.id, !selectedUser.isAdmin);
      toast.success(`Admin ${selectedUser.isAdmin ? 'removed from' : 'granted to'} user successfully`);
      setSelectedUser(null);
      setActionType(null);
      fetchUsers();
    } catch (error: any) {
      const message = error.response?.data?.error || 'Failed to update user';
      toast.error(message);
    }
  };

  const handleApproveUser = async () => {
    if (!selectedUser) return;
    try {
      await userApi.approveUser(selectedUser.id);
      toast.success(`User ${selectedUser.name} approved successfully`);
      setSelectedUser(null);
      setActionType(null);
      fetchUsers();
    } catch (error: any) {
      const message = error.response?.data?.error || 'Failed to approve user';
      toast.error(message);
    }
  };

  const handleRejectUser = async () => {
    if (!selectedUser) return;
    try {
      await userApi.rejectUser(selectedUser.id, rejectionReason);
      toast.success(`User ${selectedUser.name} rejected successfully`);
      setSelectedUser(null);
      setActionType(null);
      setRejectionReason('');
      fetchUsers();
    } catch (error: any) {
      const message = error.response?.data?.error || 'Failed to reject user';
      toast.error(message);
    }
  };

  const formatDate = (dateString?: string) => {
    return formatDateIST(dateString || '') || 'N/A';
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48 bg-slate-800" />
        <Skeleton className="h-12 bg-slate-800" />
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 bg-slate-800" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">User Management</h1>
        <p className="text-slate-400">Manage system users and permissions</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="pl-10 bg-slate-800 border-slate-700 text-white"
          placeholder="Search by name, email, or roll number..."
        />
      </div>

      {/* Users List */}
      <div className="grid gap-4">
        {users.map((user) => (
          <Card key={user.id} className="bg-slate-900 border-slate-800">
            <CardContent className="p-6">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center">
                    <span className="text-emerald-400 font-medium text-lg">
                      {user.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-semibold text-white">{user.name}</h3>
                      {user.isAdmin && (
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30">
                          <Shield className="w-3 h-3 mr-1" />
                          Admin
                        </Badge>
                      )}
                      {user.approvalStatus === 'PENDING' && (
                        <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30">
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          Pending
                        </Badge>
                      )}
                      {user.approvalStatus === 'REJECTED' && (
                        <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/30">
                          <UserX className="w-3 h-3 mr-1" />
                          Rejected
                        </Badge>
                      )}
                      {user.isBlocked && (
                        <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/30">
                          <UserX className="w-3 h-3 mr-1" />
                          Blocked
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-4 mt-2 text-sm text-slate-400 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Mail className="w-4 h-4" />
                        {user.email}
                      </span>
                      {user.rollNumber && (
                        <span className="flex items-center gap-1">
                          <IdCard className="w-4 h-4" />
                          {user.rollNumber}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Ticket className="w-4 h-4" />
                        {(user as any)._count?.bookings || 0} bookings
                      </span>
                      <span className="flex items-center gap-1">
                        <CreditCard className="w-4 h-4" />
                        {(user as any)._count?.payments || 0} pending
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {user.approvalStatus === 'PENDING' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedUser(user);
                        setActionType('approve');
                      }}
                      className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                    >
                      <UserCheck className="w-4 h-4 mr-1" />
                      Approve
                    </Button>
                  )}
                  {user.approvalStatus === 'PENDING' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedUser(user);
                        setActionType('reject');
                      }}
                      className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                    >
                      <UserX className="w-4 h-4 mr-1" />
                      Reject & Delete
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedUser(user);
                      setActionType('admin');
                    }}
                    className={user.isAdmin
                      ? 'border-amber-500/30 text-amber-400 hover:bg-amber-500/10'
                      : 'border-slate-700 text-slate-300 hover:bg-slate-800'
                    }
                  >
                    <Shield className="w-4 h-4 mr-1" />
                    {user.isAdmin ? 'Remove Admin' : 'Make Admin'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedUser(user);
                      setActionType('block');
                    }}
                    className={user.isBlocked
                      ? 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'
                      : 'border-red-500/30 text-red-400 hover:bg-red-500/10'
                    }
                  >
                    {user.isBlocked ? (
                      <>
                        <UserCheck className="w-4 h-4 mr-1" />
                        Unblock
                      </>
                    ) : (
                      <>
                        <UserX className="w-4 h-4 mr-1" />
                        Block
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="border-slate-700 text-slate-300 hover:bg-slate-800"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Previous
          </Button>
          <span className="text-slate-400">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="border-slate-700 text-slate-300 hover:bg-slate-800"
          >
            Next
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}

      {/* Action Dialog */}
      <Dialog
        open={!!selectedUser && !!actionType}
        onOpenChange={() => {
          setSelectedUser(null);
          setActionType(null);
          setRejectionReason('');
        }}
      >
        <DialogContent className="bg-slate-900 border-slate-800 text-white">
          <DialogHeader>
            <DialogTitle>
              {actionType === 'block'
                ? (selectedUser?.isBlocked ? 'Unblock User' : 'Block User')
                : actionType === 'admin'
                ? (selectedUser?.isAdmin ? 'Remove Admin' : 'Grant Admin')
                : actionType === 'approve'
                ? 'Approve User'
                : 'Reject & Delete User'
              }
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {actionType === 'block'
                ? `Are you sure you want to ${selectedUser?.isBlocked ? 'unblock' : 'block'} ${selectedUser?.name}?`
                : actionType === 'admin'
                ? `Are you sure you want to ${selectedUser?.isAdmin ? 'remove admin from' : 'grant admin to'} ${selectedUser?.name}?`
                : actionType === 'approve'
                ? `Approve ${selectedUser?.name} to access the system?`
                : `Permanently reject and delete ${selectedUser?.name}'s registration request? This action cannot be undone.`
              }
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSelectedUser(null);
                setActionType(null);
                setRejectionReason('');
              }}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (actionType === 'block') handleBlockUser();
                else if (actionType === 'admin') handleSetAdmin();
                else if (actionType === 'approve') handleApproveUser();
                else if (actionType === 'reject') handleRejectUser();
              }}
              className={actionType === 'block' && !selectedUser?.isBlocked
                ? 'bg-red-500 hover:bg-red-600'
                : actionType === 'reject'
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-amber-500 hover:bg-amber-600'
              }
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserManagement;
