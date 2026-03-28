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
  ChevronRight
} from 'lucide-react';

const UserManagement = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [actionType, setActionType] = useState<'block' | 'admin' | null>(null);

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

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-IN', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
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
        }}
      >
        <DialogContent className="bg-slate-900 border-slate-800 text-white">
          <DialogHeader>
            <DialogTitle>
              {actionType === 'block' 
                ? (selectedUser?.isBlocked ? 'Unblock User' : 'Block User')
                : (selectedUser?.isAdmin ? 'Remove Admin' : 'Grant Admin')
              }
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Are you sure you want to {actionType === 'block' 
                ? (selectedUser?.isBlocked ? 'unblock' : 'block')
                : (selectedUser?.isAdmin ? 'remove admin from' : 'grant admin to')
              } {selectedUser?.name}?
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSelectedUser(null);
                setActionType(null);
              }}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </Button>
            <Button
              onClick={actionType === 'block' ? handleBlockUser : handleSetAdmin}
              className={actionType === 'block' && !selectedUser?.isBlocked 
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
