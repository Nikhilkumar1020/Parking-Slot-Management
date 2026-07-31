import React, { useState, useEffect, useCallback } from 'react';
import { useAuth, authFetch } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useSocket } from '../context/SocketContext';

const roleConfig = {
  superadmin: {
    title: 'Visitor Management — All Sites',
    subtitle: 'Full visitor oversight across all facilities. Register, track, and validate.',
    canRegister: true,
    canDelete: true,
    canToggle: true,
    showAnalytics: true,
  },
  facility_manager: {
    title: 'Facility Visitor Management',
    subtitle: 'Monitor and manage visitors at your facility.',
    canRegister: true,
    canDelete: true,
    canToggle: true,
    showAnalytics: true,
  },
  security_officer: {
    title: 'Visitor Check-in/Check-out',
    subtitle: 'Validate visitor identity, toggle arrival/departure status, and manage access.',
    canRegister: false,
    canDelete: false,
    canToggle: true,
    showAnalytics: false,
  },
};

export default function VisitorManagement() {
  const { user } = useAuth();
  const toast = useToast();
  const { socket } = useSocket();
  const role = user?.role || 'security_officer';
  const config = roleConfig[role] || roleConfig.security_officer;

  const [visitors, setVisitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [date, setDate] = useState('');
  const [purpose, setPurpose] = useState('Business');
  const [host, setHost] = useState('');

  const fetchVisitors = useCallback(async () => {
    try {
      const res = await authFetch('/api/visitors');
      if (!res.ok) throw new Error('Failed to fetch visitors');
      const data = await res.json();
      setVisitors(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchVisitors(); }, [fetchVisitors]);

  // Real-time: auto-refresh on visitor events
  useEffect(() => {
    if (!socket) return;
    const handler = () => fetchVisitors();
    socket.on('visitor:update', handler);
    return () => { socket.off('visitor:update', handler); };
  }, [socket, fetchVisitors]);

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!name || !host) return toast.success("Please fill in required fields");

    const newVisitor = {
      name, host, purpose,
      eta: date ? date : 'Today',
      status: 'Expected'
    };

    try {
      const res = await authFetch('/api/visitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newVisitor)
      });
      if (res.ok) {
        setName(''); setPhone(''); setDate(''); setHost('');
        fetchVisitors();
        toast.success("QR Pass Generated Successfully!");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this visitor?')) return;
    try {
      const res = await fetch(`/api/visitors/${id}`, { method: 'DELETE' });
      if (res.ok) fetchVisitors();
    } catch (err) {
      console.error(err);
    }
  };

  const toggleStatus = async (visitor) => {
    const nextStatus = visitor.status === 'Expected' ? 'Arrived' : visitor.status === 'Arrived' ? 'Departed' : 'Expected';
    try {
      const res = await fetch(`/api/visitors/${visitor.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      });
      if (res.ok) fetchVisitors();
    } catch (err) {
      console.error(err);
    }
  };

  const arrivedCount = visitors.filter(v => v.status === 'Arrived').length;
  const expectedCount = visitors.filter(v => v.status === 'Expected').length;
  const departedCount = visitors.filter(v => v.status === 'Departed').length;

  return (
    <>
      <div className="mb-xl">
        <h2 className="font-headline-lg text-headline-lg text-on-background mb-1">{config.title}</h2>
        <p className="font-body-md text-body-md text-on-surface-variant">{config.subtitle}</p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-lg">
        {/* Registration Form — only for roles that can register */}
        {config.canRegister && (
          <div className="lg:col-span-4 flex flex-col gap-lg">
            <section className="glass-card rounded-xl p-lg shadow-sm">
              <div className="flex items-center gap-sm mb-lg">
                <span className="material-symbols-outlined text-primary">person_add</span>
                <h3 className="font-headline-md text-headline-md text-on-background">Pre-Register Visitor</h3>
              </div>
              <form onSubmit={handleRegister} className="space-y-md">
                <div>
                  <label className="block font-label-md text-label-md text-on-surface-variant mb-xs">Visitor Full Name</label>
                  <input 
                    value={name} onChange={e => setName(e.target.value)}
                    className="w-full rounded-lg border border-outline-variant focus:border-primary px-3 py-2 bg-surface outline-none" 
                    placeholder="e.g. Jordan Smith" type="text" required
                  />
                </div>
                <div>
                  <label className="block font-label-md text-label-md text-on-surface-variant mb-xs">Phone Number</label>
                  <input 
                    value={phone} onChange={e => setPhone(e.target.value)}
                    className="w-full rounded-lg border border-outline-variant focus:border-primary px-3 py-2 bg-surface outline-none" 
                    placeholder="+1 (555) 000-0000" type="tel"
                  />
                </div>
                <div className="grid grid-cols-2 gap-sm">
                  <div>
                    <label className="block font-label-md text-label-md text-on-surface-variant mb-xs">Visit Date</label>
                    <input 
                      value={date} onChange={e => setDate(e.target.value)}
                      className="w-full rounded-lg border border-outline-variant focus:border-primary px-3 py-2 bg-surface outline-none" 
                      type="date"
                    />
                  </div>
                  <div>
                    <label className="block font-label-md text-label-md text-on-surface-variant mb-xs">Visit Type</label>
                    <select 
                      value={purpose} onChange={e => setPurpose(e.target.value)}
                      className="w-full rounded-lg border border-outline-variant focus:border-primary px-3 py-2 bg-surface outline-none"
                    >
                      <option>Business</option>
                      <option>Delivery</option>
                      <option>Maintenance</option>
                      <option>Other</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block font-label-md text-label-md text-on-surface-variant mb-xs">Host Name</label>
                  <input 
                    value={host} onChange={e => setHost(e.target.value)}
                    className="w-full rounded-lg border border-outline-variant focus:border-primary px-3 py-2 bg-surface outline-none" 
                    placeholder="Department or Person" type="text" required
                  />
                </div>
                <button 
                  type="submit"
                  className="w-full bg-primary text-on-primary py-md rounded-lg font-bold flex items-center justify-center gap-sm hover:brightness-90 transition-all group cursor-pointer"
                >
                  <span className="material-symbols-outlined group-hover:scale-110 transition-transform">qr_code_2</span>
                  Generate QR Pass
                </button>
              </form>
            </section>
          </div>
        )}

        {/* Live Visitor List */}
        <div className={config.canRegister ? 'lg:col-span-8' : 'lg:col-span-12'}>
          {/* Security Officer: Quick Status Bar */}
          {role === 'security_officer' && (
            <div className="grid grid-cols-3 gap-md mb-lg">
              <div className="bg-tertiary-container/30 border border-tertiary/20 rounded-xl p-md text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Expected</p>
                <h3 className="font-display text-display text-tertiary">{expectedCount}</h3>
              </div>
              <div className="bg-secondary-container/30 border border-secondary/20 rounded-xl p-md text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">On-Site</p>
                <h3 className="font-display text-display text-secondary">{arrivedCount}</h3>
              </div>
              <div className="bg-surface-container border border-outline-variant rounded-xl p-md text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Departed</p>
                <h3 className="font-display text-display text-on-surface-variant">{departedCount}</h3>
              </div>
            </div>
          )}

          <section className="glass-card rounded-xl shadow-sm overflow-hidden h-full flex flex-col">
            <div className="p-lg border-b border-outline-variant flex flex-col md:flex-row justify-between items-start md:items-center gap-md">
              <div>
                <h3 className="font-headline-md text-headline-md text-on-background">
                  {role === 'security_officer' ? 'Gate Check-in Log' : 'Live Visitor List'}
                </h3>
                <p className="font-label-md text-label-md text-on-surface-variant">Currently {arrivedCount} visitors on-site</p>
              </div>
            </div>
            <div className="overflow-x-auto flex-1">
              {loading ? (
                <div className="flex justify-center items-center py-20"><span className="material-symbols-outlined animate-spin text-3xl text-primary">refresh</span></div>
              ) : (
                <table className="w-full text-left">
                  <thead className="bg-surface-container-low sticky top-0">
                    <tr>
                      <th className="px-lg py-4 font-label-md text-label-md text-on-surface-variant font-bold border-b border-outline-variant">Visitor</th>
                      <th className="px-lg py-4 font-label-md text-label-md text-on-surface-variant font-bold border-b border-outline-variant">Purpose</th>
                      <th className="px-lg py-4 font-label-md text-label-md text-on-surface-variant font-bold border-b border-outline-variant">Status</th>
                      <th className="px-lg py-4 font-label-md text-label-md text-on-surface-variant font-bold border-b border-outline-variant text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant">
                    {visitors.map(v => (
                      <tr key={v.id} className="hover:bg-surface-container-lowest transition-colors">
                        <td className="px-lg py-4">
                          <div className="flex items-center gap-sm">
                            <div className="w-10 h-10 rounded-full bg-primary-container text-primary flex items-center justify-center font-bold">
                              {v.name.charAt(0)}
                            </div>
                            <div>
                              <p className="font-bold text-on-surface">{v.name}</p>
                              <p className="text-[11px] text-on-surface-variant">Host: {v.host}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-lg py-4">
                          <div className="flex flex-col gap-1">
                            <span className="font-label-md text-label-md text-on-surface">{v.purpose}</span>
                            <span className="text-[10px] text-on-surface-variant flex items-center gap-1">
                              <span className="material-symbols-outlined text-[12px]">schedule</span> {v.eta}
                            </span>
                          </div>
                        </td>
                        <td className="px-lg py-4">
                          <span className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase ${
                            v.status === 'Expected' ? 'bg-tertiary-container text-on-tertiary-container' :
                            v.status === 'Arrived' ? 'bg-secondary-container text-on-secondary-container' :
                            'bg-surface-variant text-on-surface-variant'
                          }`}>
                            {v.status}
                          </span>
                        </td>
                        <td className="px-lg py-4">
                          <div className="flex justify-end gap-sm">
                            {config.canToggle && (
                              <button 
                                onClick={() => toggleStatus(v)}
                                className="px-4 py-1.5 border border-outline-variant rounded-full text-label-md font-bold text-on-surface-variant hover:border-primary hover:text-primary transition-colors cursor-pointer"
                              >
                                {role === 'security_officer' 
                                  ? (v.status === 'Expected' ? 'Check In' : v.status === 'Arrived' ? 'Check Out' : 'Reset')
                                  : 'Toggle'}
                              </button>
                            )}
                            {config.canDelete && (
                              <button onClick={() => handleDelete(v.id)} className="p-1.5 text-error hover:bg-error/10 rounded-full transition-colors cursor-pointer">
                                <span className="material-symbols-outlined text-[18px]">delete</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {visitors.length === 0 && (
                      <tr>
                        <td colSpan="4" className="px-lg py-8 text-center text-on-surface-variant">No visitors registered.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </div>

        {/* Analytics — only for admin roles */}
        {config.showAnalytics && (
          <div className="lg:col-span-12">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-lg">
              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-lg text-center">
                <span className="material-symbols-outlined text-tertiary text-[48px]">schedule</span>
                <p className="font-label-md text-on-surface-variant uppercase tracking-wider mt-sm mb-xs">Expected Today</p>
                <h3 className="font-display text-display text-tertiary">{expectedCount}</h3>
              </div>
              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-lg text-center">
                <span className="material-symbols-outlined text-secondary text-[48px]">how_to_reg</span>
                <p className="font-label-md text-on-surface-variant uppercase tracking-wider mt-sm mb-xs">Currently On-Site</p>
                <h3 className="font-display text-display text-secondary">{arrivedCount}</h3>
              </div>
              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-lg text-center">
                <span className="material-symbols-outlined text-on-surface-variant text-[48px]">logout</span>
                <p className="font-label-md text-on-surface-variant uppercase tracking-wider mt-sm mb-xs">Departed</p>
                <h3 className="font-display text-display text-on-surface-variant">{departedCount}</h3>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}





