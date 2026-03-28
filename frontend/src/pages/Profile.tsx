import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { userApi } from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  User,
  Mail,
  Phone,
  Building,
  IdCard,
  Calendar,
  Shield,
  Save,
  CheckCircle
} from 'lucide-react';

const Profile = () => {
  const { user, refreshUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    department: user?.department || ''
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      await userApi.updateProfile(formData);
      toast.success('Profile updated successfully');
      refreshUser();
      setEditing(false);
    } catch (error: any) {
      const message = error.response?.data?.error || 'Failed to update profile';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      name: user?.name || '',
      phone: user?.phone || '',
      department: user?.department || ''
    });
    setEditing(false);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Profile</h1>
        <p className="text-slate-400">Manage your account information</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <Card className="bg-slate-900 border-slate-800 lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-white flex items-center gap-2">
              <User className="w-5 h-5 text-emerald-400" />
              Personal Information
            </CardTitle>
            {!editing && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditing(true)}
                className="border-slate-700 text-slate-300 hover:bg-slate-800"
              >
                Edit Profile
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Name */}
            <div className="space-y-2">
              <Label className="text-slate-400 flex items-center gap-2">
                <User className="w-4 h-4" />
                Full Name
              </Label>
              {editing ? (
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="bg-slate-800 border-slate-700 text-white"
                  placeholder="Enter your name"
                />
              ) : (
                <p className="text-white text-lg">{user?.name}</p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label className="text-slate-400 flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email Address
              </Label>
              <div className="flex items-center gap-3">
                <p className="text-white">{user?.email}</p>
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Verified
                </Badge>
              </div>
            </div>

            {/* Roll Number */}
            <div className="space-y-2">
              <Label className="text-slate-400 flex items-center gap-2">
                <IdCard className="w-4 h-4" />
                Roll Number
              </Label>
              <p className="text-white">{user?.rollNumber || 'Not available'}</p>
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label className="text-slate-400 flex items-center gap-2">
                <Phone className="w-4 h-4" />
                Phone Number
              </Label>
              {editing ? (
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="bg-slate-800 border-slate-700 text-white"
                  placeholder="Enter 10-digit phone number"
                  maxLength={10}
                />
              ) : (
                <p className="text-white">{user?.phone || 'Not set'}</p>
              )}
            </div>

            {/* Department */}
            <div className="space-y-2">
              <Label className="text-slate-400 flex items-center gap-2">
                <Building className="w-4 h-4" />
                Department
              </Label>
              {editing ? (
                <Input
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="bg-slate-800 border-slate-700 text-white"
                  placeholder="Enter your department"
                />
              ) : (
                <p className="text-white">{user?.department || 'Not set'}</p>
              )}
            </div>

            {/* Edit Actions */}
            {editing && (
              <div className="flex gap-3 pt-4">
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-emerald-500 hover:bg-emerald-600"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleCancel}
                  disabled={saving}
                  className="border-slate-700 text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Account Info Card */}
        <div className="space-y-6">
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-emerald-400" />
                Account Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-slate-800">
                <span className="text-slate-400">Account Type</span>
                <Badge 
                  variant="outline" 
                  className={user?.isAdmin 
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' 
                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  }
                >
                  {user?.isAdmin ? 'Administrator' : 'Student'}
                </Badge>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-800">
                <span className="text-slate-400">Member Since</span>
                <span className="text-white">{formatDate(user?.createdAt)}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-slate-400">Status</span>
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                  Active
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Quick Links */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white text-base">Quick Links</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button asChild variant="outline" className="w-full justify-start border-slate-700 text-slate-300 hover:bg-slate-800">
                <a href="/my-bookings">
                  <IdCard className="w-4 h-4 mr-2" />
                  My Bookings
                </a>
              </Button>
              <Button asChild variant="outline" className="w-full justify-start border-slate-700 text-slate-300 hover:bg-slate-800">
                <a href="/payments">
                  <Phone className="w-4 h-4 mr-2" />
                  Payments
                </a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Profile;
