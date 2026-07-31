import React, { useState, useEffect, useCallback } from 'react';
import { useAuth, authFetch } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useToast } from '../context/ToastContext';

const ROLE_LABELS = {
  superadmin: 'Super Admin',
  facility_manager: 'Facility Manager',
  parking_administrator: 'Parking Admin',
  security_officer: 'Security Officer',
  employee: 'Employee',
  visitor: 'Visitor',
};

const ROLE_COLORS = {
  superadmin: 'bg-purple-100 text-purple-700',
  facility_manager: 'bg-blue-100 text-blue-700',
  parking_administrator: 'bg-indigo-100 text-indigo-700',
  security_officer: 'bg-red-100 text-red-700',
  employee: 'bg-green-100 text-green-700',
  visitor: 'bg-gray-100 text-gray-700',
};

const STATUS_COLORS = {
  Active: 'bg-secondary-container text-on-secondary-container',
  Inactive: 'bg-error-container text-on-error-container',
};

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const { socket } = useSocket();
  const toast = useToast();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editUser, setEditUser] = useState(null);

  // Add user form
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('employee');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await authFetch('/api/users');
      if (!res.ok) throw new Error('Failed to fetch users');
      const payload = await res.json();
      // Handle paginated response shape: { data, total, page, pages }
      const data = Array.isArray(payload) ? payload : (payload.data || []);
      setUsers(data);
    } catch (err) {
      toast.error(err.message, 'Load Failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  useEffect(() => {
    if (!socket) return;
    const handler = () => fetchUsers();
    socket.on('user:update', handler);
    return () => { socket.off('user:update', handler); };
  }, [socket, fetchUsers]);

  const handleAddUser = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await authFetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, email: newEmail, password: newPassword, role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');
      toast.success(`${newName} has been added as ${ROLE_LABELS[newRole]}.`, 'User Created');
      setShowAddModal(false);
      setNewName(''); setNewEmail(''); setNewPassword(''); setNewRole('employee');
      fetchUsers();
    } catch (err) {
      toast.error(err.message, 'Add Failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (user) => {
    const newStatus = user.status === 'Active' ? 'Inactive' : 'Active';
    try {
      const res = await authFetch(`/api/users/${user.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Failed to update status');
      toast.success(`${user.name} is now ${newStatus}.`, 'Status Updated');
      fetchUsers();
    } catch (err) {
      toast.error(err.message, 'Update Failed');
    }
  };

  const handleDeleteUser = async (user) => {
    if (!window.confirm(`Are you sure you want to permanently delete ${user.name}?`)) return;
    try {
      const res = await authFetch(`/api/users/${user.id}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      toast.success(`${user.name} has been removed.`, 'User Deleted');
    } catch (err) {
      toast.error(err.message, 'Delete Failed');
    }
  };

  const handleRoleChange = async (user, newRole) => {
    try {
      const res = await authFetch(`/api/users/${user.id}`, {
        method: 'PUT',
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) throw new Error('Failed to update role');
      toast.success(`${user.name}'s role changed to ${ROLE_LABELS[newRole]}.`, 'Role Updated');
      fetchUsers();
    } catch (err) {
      toast.error(err.message, 'Role Update Failed');
    }
  };

  const filtered = users.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const matchesRole = filterRole === 'all' || u.role === filterRole;
    return matchesSearch && matchesRole;
  });

  const stats = {
    total: users.length,
    active: users.filter(u => u.status === 'Active').length,
    admins: users.filter(u => u.role === 'superadmin' || u.role === 'facility_manager').length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-md">
          <span className="material-symbols-outlined text-4xl text-primary animate-spin">refresh</span>
          <p className="text-on-surface-variant">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-md mb-xl">
        <div>
          <p className="text-on-surface-variant font-label-md uppercase tracking-wider mb-xs">System Administration</p>
          <h2 className="font-display text-display text-on-surface">User Management</h2>
          <p className="text-on-surface-variant font-body-md mt-xs">View, create, and manage all system users and their roles.</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-sm bg-primary text-on-primary px-xl py-md rounded-xl font-body-md shadow-sm hover:bg-on-primary-fixed-variant transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined">person_add</span>
          Add User
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-md mb-lg">
        {[
          { label: 'Total Users', value: stats.total, icon: 'group', color: 'text-primary' },
          { label: 'Active Users', value: stats.active, icon: 'check_circle', color: 'text-secondary' },
          { label: 'Admin Roles', value: stats.admins, icon: 'admin_panel_settings', color: 'text-tertiary' },
        ].map(stat => (
          <div key={stat.label} className="glass-card rounded-xl p-md flex items-center gap-md">
            <span className={`material-symbols-outlined text-[32px] ${stat.color}`} style={{ fontVariationSettings: "'FILL' 1" }}>{stat.icon}</span>
            <div>
              <p className="font-display text-[28px] font-bold leading-none">{stat.value}</p>
              <p className="text-on-surface-variant font-label-md">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-md mb-lg">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-md top-1/2 -translate-y-1/2 text-outline">search</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full pl-xl pr-md py-md rounded-lg border border-outline-variant bg-surface focus:border-primary outline-none transition-all font-body-md"
          />
        </div>
        <select
          value={filterRole}
          onChange={e => setFilterRole(e.target.value)}
          className="px-md py-md rounded-lg border border-outline-variant bg-surface focus:border-primary outline-none font-body-md cursor-pointer"
        >
          <option value="all">All Roles</option>
          {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {/* Users Table */}
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-surface-container-low border-b border-outline-variant">
              <tr>
                {['User', 'Role', 'Status', 'Joined', 'Actions'].map(h => (
                  <th key={h} className="text-left px-lg py-md font-label-md text-on-surface-variant uppercase tracking-wider text-[11px]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-xl text-on-surface-variant">
                    <span className="material-symbols-outlined text-[48px] block mb-sm opacity-30">group_off</span>
                    No users found
                  </td>
                </tr>
              ) : filtered.map(u => (
                <tr key={u.id} className="hover:bg-surface-container-low/50 transition-colors group">
                  <td className="px-lg py-md">
                    <div className="flex items-center gap-md">
                      <img
                        src={`https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=0D8BFF&color=fff&size=40`}
                        className="w-10 h-10 rounded-full border border-outline-variant"
                        alt={u.name}
                      />
                      <div>
                        <p className="font-bold text-body-md text-on-surface flex items-center gap-xs">
                          {u.name}
                          {u.id === currentUser?.id && <span className="text-[10px] bg-primary-container text-on-primary-container px-xs py-[2px] rounded-full font-label-md">You</span>}
                        </p>
                        <p className="text-[12px] text-on-surface-variant">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-lg py-md">
                    <select
                      value={u.role}
                      onChange={e => handleRoleChange(u, e.target.value)}
                      disabled={u.id === currentUser?.id}
                      className={`px-sm py-xs rounded-lg font-label-md text-[12px] font-bold border-none outline-none cursor-pointer disabled:cursor-default ${ROLE_COLORS[u.role]}`}
                    >
                      {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </td>
                  <td className="px-lg py-md">
                    <span className={`px-sm py-xs rounded-full font-label-md text-[11px] font-bold ${STATUS_COLORS[u.status] || STATUS_COLORS.Active}`}>
                      {u.status || 'Active'}
                    </span>
                  </td>
                  <td className="px-lg py-md">
                    <span className="text-on-surface-variant text-body-md">
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                    </span>
                  </td>
                  <td className="px-lg py-md">
                    <div className="flex items-center gap-sm opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleToggleStatus(u)}
                        disabled={u.id === currentUser?.id}
                        title={u.status === 'Active' ? 'Deactivate' : 'Activate'}
                        className="p-sm rounded-lg hover:bg-surface-container transition-colors cursor-pointer disabled:opacity-30"
                      >
                        <span className="material-symbols-outlined text-[18px] text-on-surface-variant">
                          {u.status === 'Active' ? 'block' : 'check_circle'}
                        </span>
                      </button>
                      <button
                        onClick={() => handleDeleteUser(u)}
                        disabled={u.id === currentUser?.id}
                        title="Delete user"
                        className="p-sm rounded-lg hover:bg-error-container transition-colors cursor-pointer disabled:opacity-30"
                      >
                        <span className="material-symbols-outlined text-[18px] text-error">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-lg">
          <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-md p-xl">
            <div className="flex items-center justify-between mb-lg">
              <h3 className="font-headline-md text-headline-md">Add New User</h3>
              <button onClick={() => setShowAddModal(false)} className="p-sm rounded-full hover:bg-surface-container cursor-pointer">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleAddUser} className="space-y-md">
              <div className="flex flex-col gap-xs">
                <label className="font-label-md text-on-surface-variant">Full Name</label>
                <input value={newName} onChange={e => setNewName(e.target.value)} required placeholder="Jane Doe" className="border border-outline-variant rounded-lg p-md outline-none focus:border-primary transition-all" />
              </div>
              <div className="flex flex-col gap-xs">
                <label className="font-label-md text-on-surface-variant">Email Address</label>
                <input value={newEmail} onChange={e => setNewEmail(e.target.value)} required type="email" placeholder="jane@parksystem.com" className="border border-outline-variant rounded-lg p-md outline-none focus:border-primary transition-all" />
              </div>
              <div className="flex flex-col gap-xs">
                <label className="font-label-md text-on-surface-variant">Temporary Password</label>
                <input value={newPassword} onChange={e => setNewPassword(e.target.value)} required type="password" placeholder="Min. 6 characters" className="border border-outline-variant rounded-lg p-md outline-none focus:border-primary transition-all" />
              </div>
              <div className="flex flex-col gap-xs">
                <label className="font-label-md text-on-surface-variant">Role</label>
                <select value={newRole} onChange={e => setNewRole(e.target.value)} className="border border-outline-variant rounded-lg p-md outline-none focus:border-primary transition-all cursor-pointer">
                  {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="flex gap-md pt-md">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 border border-outline-variant px-lg py-md rounded-lg font-label-md hover:bg-surface-container transition-colors cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting} className="flex-1 bg-primary text-on-primary px-lg py-md rounded-lg font-label-md hover:brightness-95 transition-all cursor-pointer disabled:opacity-60 flex items-center justify-center gap-sm">
                  {isSubmitting && <span className="material-symbols-outlined text-[16px] animate-spin">refresh</span>}
                  {isSubmitting ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

