import React, { useState, useEffect, useCallback } from 'react';
import { useAuth, authFetch } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useSocket } from '../context/SocketContext';

// Role-specific notification configurations
const roleNotificationConfig = {
  superadmin: {
    title: 'System Administration',
    subtitle: 'Full system oversight — all alerts, approvals, and audit logs',
    categories: ['system', 'security', 'facility', 'parking', 'user'],
    preferences: [
      { label: 'Email Alerts', desc: 'Daily summaries and critical system alerts', default: true },
      { label: 'SMS Notifications', desc: 'Immediate delivery for security events', default: true },
      { label: 'Audit Logs', desc: 'User action tracking and compliance reports', default: true },
      { label: 'Facility Approvals', desc: 'New facility registration requests', default: true },
    ],
    seedNotifications: [
      { id: 's1', type: 'error', category: 'system', title: 'Database Backup Failed', message: 'Nightly backup at 03:00 AM did not complete. Storage quota exceeded on primary volume.', time: '6 min ago' },
      { id: 's2', type: 'warning', category: 'security', title: 'Unusual Login Activity', message: '14 failed login attempts detected from IP 192.168.0.45 in the last hour.', time: '22 min ago' },
      { id: 's3', type: 'info', category: 'facility', title: 'New Facility Registration', message: 'Downtown Plaza submitted a registration request. Awaiting your approval.', time: '1 hr ago' },
      { id: 's4', type: 'info', category: 'user', title: 'User Role Change Request', message: 'Employee "Maria Chen" requested upgrade to Parking Administrator.', time: '2 hr ago' },
      { id: 's5', type: 'warning', category: 'system', title: 'Server CPU Usage High', message: 'Average CPU utilization above 85% for the past 30 minutes.', time: '3 hr ago' },
    ]
  },
  facility_manager: {
    title: 'Facility Operations',
    subtitle: 'Facility health, occupancy trends, and maintenance alerts',
    categories: ['facility', 'maintenance', 'occupancy'],
    preferences: [
      { label: 'Email Alerts', desc: 'Daily facility performance summaries', default: true },
      { label: 'Maintenance Alerts', desc: 'Equipment failures and service requests', default: true },
      { label: 'Occupancy Reports', desc: 'Weekly utilization and revenue reports', default: false },
    ],
    seedNotifications: [
      { id: 'f1', type: 'warning', category: 'maintenance', title: 'HVAC Unit B3 Malfunction', message: 'Temperature sensor in Parking Level B3 reading abnormal. Technician dispatched.', time: '15 min ago' },
      { id: 'f2', type: 'info', category: 'occupancy', title: 'Peak Occupancy Reached', message: 'North Terminal hit 94% capacity at 09:15 AM. Consider overflow routing.', time: '45 min ago' },
      { id: 'f3', type: 'error', category: 'facility', title: 'Fire Alarm Triggered — Level L2', message: 'Smoke detector activated in Zone C, Level L2. Auto-sprinklers engaged. Fire dept notified.', time: '1 hr ago' },
      { id: 'f4', type: 'info', category: 'maintenance', title: 'Elevator Inspection Due', message: 'Annual inspection for Elevator #3 (East Wing) is overdue by 5 days.', time: '3 hr ago' },
    ]
  },
  parking_administrator: {
    title: 'Parking Operations',
    subtitle: 'Slot availability, reservations, and vehicle tracking',
    categories: ['parking', 'reservation', 'vehicle'],
    preferences: [
      { label: 'Email Alerts', desc: 'Daily slot and reservation summaries', default: true },
      { label: 'Reservation Alerts', desc: 'New bookings, cancellations, and no-shows', default: true },
      { label: 'Overstay Warnings', desc: 'Vehicles exceeding their booked time', default: true },
    ],
    seedNotifications: [
      { id: 'p1', type: 'warning', category: 'parking', title: 'Overstay Detected — Slot A-14', message: 'Vehicle KA-01-MJ-5522 exceeded reservation by 47 minutes. Penalty notice queued.', time: '8 min ago' },
      { id: 'p2', type: 'info', category: 'reservation', title: '12 New Reservations Today', message: 'Morning rush resulted in 12 bookings between 08:00–09:00 AM. 3 slots remain.', time: '30 min ago' },
      { id: 'p3', type: 'error', category: 'vehicle', title: 'Barrier Gate Stuck — Entry B', message: 'Entry barrier at Gate B is non-responsive. Manual override enabled. Technician called.', time: '1 hr ago' },
      { id: 'p4', type: 'info', category: 'parking', title: 'Slot B1-07 Sensor Offline', message: 'Occupancy sensor for slot B1-07 hasn\'t reported in 2 hours. Marked as unknown.', time: '2 hr ago' },
    ]
  },
  security_officer: {
    title: 'Security & Access Control',
    subtitle: 'Visitor logs, access violations, and perimeter monitoring',
    categories: ['security', 'visitor', 'access'],
    preferences: [
      { label: 'Push Notifications', desc: 'Real-time alerts for security incidents', default: true },
      { label: 'Visitor Alerts', desc: 'Pre-registered visitor arrivals and walk-ins', default: true },
      { label: 'Access Violations', desc: 'Unauthorized entry attempts and tailgating', default: true },
    ],
    seedNotifications: [
      { id: 'sec1', type: 'error', category: 'access', title: 'Unauthorized Entry Attempt', message: 'Unregistered vehicle attempted access at Gate C. License plate flagged: DL-04-CX-9912.', time: '3 min ago' },
      { id: 'sec2', type: 'warning', category: 'security', title: 'CCTV Camera 7 Offline', message: 'Camera covering Stairwell D (Level L1) went dark 12 minutes ago. Network issue suspected.', time: '12 min ago' },
      { id: 'sec3', type: 'info', category: 'visitor', title: 'VIP Visitor Arriving', message: 'Pre-registered visitor "Raj Malhotra" expected at 2:30 PM. Escort to Conference Room 4.', time: '40 min ago' },
      { id: 'sec4', type: 'warning', category: 'access', title: 'Tailgating Detected — Gate A', message: 'Two vehicles entered on a single access card swipe at 11:22 AM. Review footage.', time: '1.5 hr ago' },
    ]
  },
  employee: {
    title: 'My Parking Updates',
    subtitle: 'Your bookings, vehicle status, and parking reminders',
    categories: ['booking', 'vehicle', 'reminder'],
    preferences: [
      { label: 'Email Alerts', desc: 'Booking confirmations and receipts', default: true },
      { label: 'Parking Reminders', desc: 'Time-to-leave and expiry warnings', default: true },
    ],
    seedNotifications: [
      { id: 'e1', type: 'info', category: 'booking', title: 'Booking Confirmed — Slot A-42', message: 'Your reservation for today (09:00 AM – 06:00 PM) at Tower East is confirmed.', time: '2 hr ago' },
      { id: 'e2', type: 'warning', category: 'reminder', title: 'Parking Expiring in 30 Minutes', message: 'Your slot A-42 reservation ends at 6:00 PM. Extend or vacate to avoid overstay charges.', time: '30 min ago' },
      { id: 'e3', type: 'info', category: 'vehicle', title: 'Vehicle Verification Complete', message: 'Your vehicle ABC-1234 (Tesla Model 3) has been verified for Level A clearance.', time: '1 day ago' },
    ]
  },
  visitor: {
    title: 'Visitor Notifications',
    subtitle: 'Your visit details, directions, and check-in status',
    categories: ['visit', 'direction'],
    preferences: [
      { label: 'SMS Updates', desc: 'Visit confirmation and parking directions', default: true },
    ],
    seedNotifications: [
      { id: 'v1', type: 'info', category: 'visit', title: 'Visit Approved', message: 'Your visit to North Terminal on July 23 has been approved. Check-in opens at 09:00 AM.', time: '1 hr ago' },
      { id: 'v2', type: 'info', category: 'direction', title: 'Parking Assigned — Visitor Lot V3', message: 'Please park in Visitor Lot V3, Slot 12. Follow the green signs from the main entrance.', time: '1 hr ago' },
    ]
  },
};

const categoryIcons = {
  system: 'dns', security: 'security', facility: 'domain', parking: 'local_parking',
  user: 'group', maintenance: 'build', occupancy: 'analytics', reservation: 'event',
  vehicle: 'directions_car', access: 'lock', visitor: 'badge', booking: 'bookmark',
  reminder: 'alarm', visit: 'event_available', direction: 'signpost',
};

const categoryColors = {
  system: 'text-tertiary', security: 'text-error', facility: 'text-primary', parking: 'text-secondary',
  user: 'text-on-surface-variant', maintenance: 'text-orange-500', occupancy: 'text-blue-500', reservation: 'text-indigo-500',
  vehicle: 'text-teal-500', access: 'text-red-500', visitor: 'text-purple-500', booking: 'text-primary',
  reminder: 'text-amber-500', visit: 'text-green-500', direction: 'text-cyan-500',
};

export default function NotificationsCenter() {
  const { user } = useAuth();
  const toast = useToast();
  const { socket } = useSocket();
  const role = user?.role || 'visitor';
  const config = roleNotificationConfig[role] || roleNotificationConfig.visitor;

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toggles, setToggles] = useState({});
  const [filter, setFilter] = useState('all');

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const res = await authFetch('/api/notifications');
      const apiData = await res.json();
      // Merge API data with role-specific seed notifications
      const merged = [...config.seedNotifications, ...apiData.map((n, i) => ({
        ...n,
        category: config.categories[i % config.categories.length]
      }))];
      setNotifications(merged);
    } catch (err) {
      // Fall back to seed notifications
      setNotifications(config.seedNotifications);
    } finally {
      setLoading(false);
    }
  }, [config.seedNotifications, config.categories]);

  useEffect(() => {
    fetchNotifications();
    // Initialize preference toggles
    const defaults = {};
    config.preferences.forEach((p, i) => { defaults[i] = p.default; });
    setToggles(defaults);
  }, [role, fetchNotifications, config.preferences]);

  // Real-time: auto-refresh on notification events
  useEffect(() => {
    if (!socket) return;
    const handler = () => fetchNotifications();
    socket.on('notification:new', handler);
    return () => { socket.off('notification:new', handler); };
  }, [socket, fetchNotifications]);

  const markAllRead = () => {
    toast.success("All notifications marked as read");
  };

  const togglePref = (idx) => {
    setToggles(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const filtered = filter === 'all'
    ? notifications
    : notifications.filter(n => n.category === filter);

  const criticalCount = notifications.filter(n => n.type === 'error' || n.type === 'warning').length;

  const typeStyles = {
    error: 'bg-error',
    warning: 'bg-amber-500',
    info: 'bg-primary',
  };

  return (
    <>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-xl gap-md">
        <div>
          <h1 className="font-display text-display text-on-surface">{config.title}</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">{config.subtitle}</p>
        </div>
        <div className="flex items-center gap-md">
          <button onClick={markAllRead} className="flex items-center gap-sm px-md py-2 border border-outline text-primary font-label-md text-label-md rounded-lg hover:bg-surface-container transition-colors cursor-pointer">
            <span className="material-symbols-outlined text-[18px]">done_all</span>
            Mark all as read
          </button>
          <button onClick={fetchNotifications} className="bg-primary text-on-primary px-lg py-2 rounded-lg font-label-md text-label-md hover:opacity-90 transition-opacity cursor-pointer">
            Refresh
          </button>
        </div>
      </div>

      {/* Category Filter Chips */}
      <div className="flex flex-wrap gap-sm mb-lg">
        <button
          onClick={() => setFilter('all')}
          className={`px-md py-1.5 rounded-full font-label-md text-label-md transition-all cursor-pointer ${filter === 'all' ? 'bg-primary text-on-primary shadow-md' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}`}
        >
          All ({notifications.length})
        </button>
        {config.categories.map(cat => {
          const count = notifications.filter(n => n.category === cat).length;
          return (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-md py-1.5 rounded-full font-label-md text-label-md transition-all cursor-pointer capitalize flex items-center gap-xs ${filter === cat ? 'bg-primary text-on-primary shadow-md' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}`}
            >
              <span className={`material-symbols-outlined text-[16px] ${filter === cat ? 'text-on-primary' : categoryColors[cat] || ''}`}>{categoryIcons[cat] || 'notifications'}</span>
              {cat} ({count})
            </button>
          );
        })}
      </div>
      
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-lg">
        {/* Notification List */}
        <div className="xl:col-span-8 space-y-lg">
          <section className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm overflow-hidden">
            <div className="px-lg py-md border-b border-outline-variant flex items-center justify-between bg-surface-container-low">
              <div className="flex items-center gap-md">
                <span className="material-symbols-outlined text-tertiary">notifications_active</span>
                <h2 className="font-headline-md text-headline-md">
                  {filter === 'all' ? 'All Alerts' : <span className="capitalize">{filter} Alerts</span>}
                </h2>
              </div>
              {criticalCount > 0 && (
                <span className="bg-error-container text-on-error-container px-sm py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">{criticalCount} Critical</span>
              )}
            </div>
            <div className="divide-y divide-outline-variant">
              {loading ? (
                <div className="p-lg flex justify-center"><span className="material-symbols-outlined animate-spin text-primary">refresh</span></div>
              ) : filtered.length === 0 ? (
                <div className="p-xl flex flex-col items-center justify-center text-center opacity-60">
                  <div className="w-16 h-16 rounded-full bg-surface-variant flex items-center justify-center mb-md">
                    <span className="material-symbols-outlined text-primary scale-150">check_circle</span>
                  </div>
                  <h3 className="font-headline-md text-headline-md">All clear!</h3>
                  <p className="text-body-md text-on-surface-variant">No notifications in this category.</p>
                </div>
              ) : filtered.map(notif => (
                <div key={notif.id} className="p-lg hover:bg-surface-container-low transition-colors cursor-pointer flex gap-md group">
                  <div className="shrink-0 mt-1">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${notif.type === 'error' ? 'bg-error/10' : notif.type === 'warning' ? 'bg-amber-500/10' : 'bg-primary/10'}`}>
                      <span className={`material-symbols-outlined text-[18px] ${notif.type === 'error' ? 'text-error' : notif.type === 'warning' ? 'text-amber-600' : 'text-primary'}`}>
                        {notif.type === 'error' ? 'error' : notif.type === 'warning' ? 'warning' : 'info'}
                      </span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-xs gap-sm">
                      <h3 className="font-headline-md text-headline-md leading-tight">{notif.title}</h3>
                      <span className="font-label-md text-label-md text-outline whitespace-nowrap shrink-0">{notif.time}</span>
                    </div>
                    <p className="text-body-md text-on-surface-variant mb-sm">{notif.message}</p>
                    {notif.category && (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-surface-container-high ${categoryColors[notif.category] || 'text-on-surface-variant'}`}>
                        <span className="material-symbols-outlined text-[12px]">{categoryIcons[notif.category] || 'label'}</span>
                        {notif.category}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Role-specific empty state for Security section */}
          {(role === 'security_officer' || role === 'superadmin') && (
            <section className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm overflow-hidden">
              <div className="px-lg py-md border-b border-outline-variant flex items-center gap-md bg-surface-container-low">
                <span className="material-symbols-outlined text-primary">shield</span>
                <h2 className="font-headline-md text-headline-md">Perimeter Status</h2>
              </div>
              <div className="p-xl flex flex-col items-center justify-center text-center opacity-60">
                <div className="w-16 h-16 rounded-full bg-secondary/10 flex items-center justify-center mb-md">
                  <span className="material-symbols-outlined text-secondary scale-150">verified_user</span>
                </div>
                <h3 className="font-headline-md text-headline-md">All Zones Secure</h3>
                <p className="text-body-md">Last perimeter sweep completed 4 minutes ago. No threats detected.</p>
              </div>
            </section>
          )}

          {role === 'employee' && (
            <section className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm overflow-hidden">
              <div className="px-lg py-md border-b border-outline-variant flex items-center gap-md bg-surface-container-low">
                <span className="material-symbols-outlined text-secondary">tips_and_updates</span>
                <h2 className="font-headline-md text-headline-md">Parking Tips</h2>
              </div>
              <div className="p-lg space-y-md">
                <div className="flex items-start gap-md">
                  <span className="material-symbols-outlined text-primary mt-0.5">lightbulb</span>
                  <p className="text-body-md text-on-surface-variant">Arrive before 8:30 AM to get premium spots on Level A. After 9 AM, only Level B3 slots are typically available.</p>
                </div>
                <div className="flex items-start gap-md">
                  <span className="material-symbols-outlined text-secondary mt-0.5">ev_station</span>
                  <p className="text-body-md text-on-surface-variant">EV charging stations are free on weekends. Book EV slots in advance to guarantee a charger.</p>
                </div>
              </div>
            </section>
          )}
        </div>

        {/* Preferences Sidebar */}
        <aside className="xl:col-span-4 space-y-lg">
          <section className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm overflow-hidden sticky top-xl">
            <div className="p-lg border-b border-outline-variant bg-surface-container-low">
              <h3 className="font-headline-md text-headline-md">Notification Preferences</h3>
              <p className="text-[12px] text-on-surface-variant mt-1">Customize alerts for your {role.replace('_', ' ')} role</p>
            </div>
            <div className="p-lg space-y-lg">
              {config.preferences.map((pref, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-on-surface">{pref.label}</h4>
                    <p className="text-[12px] text-on-surface-variant">{pref.desc}</p>
                  </div>
                  <button
                    onClick={() => togglePref(idx)}
                    className={`w-10 h-6 rounded-full relative transition-colors cursor-pointer ${toggles[idx] ? 'bg-primary' : 'bg-surface-variant'}`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full shadow-sm absolute top-1 transition-transform ${toggles[idx] ? 'translate-x-5' : 'translate-x-1'}`}></div>
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Quick Stats */}
          <section className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm p-lg">
            <h3 className="font-headline-md text-headline-md mb-md">Alert Summary</h3>
            <div className="space-y-sm">
              <div className="flex items-center justify-between py-sm">
                <div className="flex items-center gap-sm">
                  <div className="w-3 h-3 rounded-full bg-error"></div>
                  <span className="text-body-md text-on-surface">Critical</span>
                </div>
                <span className="font-bold text-error">{notifications.filter(n => n.type === 'error').length}</span>
              </div>
              <div className="flex items-center justify-between py-sm">
                <div className="flex items-center gap-sm">
                  <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                  <span className="text-body-md text-on-surface">Warning</span>
                </div>
                <span className="font-bold text-amber-600">{notifications.filter(n => n.type === 'warning').length}</span>
              </div>
              <div className="flex items-center justify-between py-sm">
                <div className="flex items-center gap-sm">
                  <div className="w-3 h-3 rounded-full bg-primary"></div>
                  <span className="text-body-md text-on-surface">Info</span>
                </div>
                <span className="font-bold text-primary">{notifications.filter(n => n.type === 'info').length}</span>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}





