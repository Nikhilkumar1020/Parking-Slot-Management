import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, authFetch } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useSocket } from '../context/SocketContext';

const roleConfig = {
  superadmin: {
    title: 'System Control Center',
    subtitle: 'Full system oversight — all facilities, users, and operations.',
    kpis: ['capacity', 'occupancy', 'revenue'],
    showApprovalQueue: true,
    showSecurityLogs: true,
    approvalLabel: 'All Pending Requests',
    mapLink: '/live-parking-map',
  },
  facility_manager: {
    title: 'Facility Operations Hub',
    subtitle: 'Monitor facility health, occupancy trends, and maintenance.',
    kpis: ['capacity', 'occupancy', 'revenue'],
    showApprovalQueue: true,
    showSecurityLogs: false,
    approvalLabel: 'Facility Reservations',
    mapLink: null,
  },
};

export default function AdminDashboard() {
  const { user } = useAuth();
  const toast = useToast();
  const { socket } = useSocket();
  const role = user?.role || 'facility_manager';
  const config = roleConfig[role] || roleConfig.facility_manager;

  const [metrics, setMetrics] = useState({});
  const [reservations, setReservations] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [resMetrics, resReservations, resNotifications] = await Promise.all([
        authFetch('/api/metrics'),
        authFetch('/api/reservations'),
        authFetch('/api/notifications')
      ]);
      
      const metricsData = await resMetrics.json();
      const resData = await resReservations.json();
      const notifData = await resNotifications.json();

      const metricsMap = {};
      metricsData.forEach(m => {
        metricsMap[m.key] = m.value;
      });
      setMetrics(metricsMap);
      
      setReservations(resData.filter(r => ['Pending', 'Confirmed', 'Checked-In'].includes(r.status)));
      setNotifications(notifData.slice(0, 4));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Real-time: auto-refresh when relevant events fire
  useEffect(() => {
    if (!socket) return;
    const handler = () => fetchData();
    socket.on('reservation:update', handler);
    socket.on('notification:new', handler);
    socket.on('metric:update', handler);
    return () => {
      socket.off('reservation:update', handler);
      socket.off('notification:new', handler);
      socket.off('metric:update', handler);
    };
  }, [socket, fetchData]);

  const handleStatusChange = async (id, status) => {
    try {
      const res = await authFetch(`/api/reservations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        toast.success(`Reservation marked as ${status}`);
        fetchData();
      } else {
        toast.error(`Failed to update status to ${status}`);
      }
    } catch (err) {
      console.error(err);
      toast.error("An error occurred");
    }
  };

  return (
    <>
      <div className="max-w-[1440px] mx-auto space-y-lg">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-md">
          <div>
            <h2 className="font-headline-lg text-headline-lg text-on-surface">{config.title}</h2>
            <p className="text-body-md text-on-surface-variant">{config.subtitle}</p>
          </div>
          <div className="flex items-center gap-md">
            {role === 'superadmin' && (
              <span className="bg-error-container text-on-error-container px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">shield</span>
                Super Admin
              </span>
            )}
            {config.mapLink && (
              <Link to={config.mapLink} className="bg-primary hover:bg-primary-container text-on-primary flex items-center gap-sm px-lg py-sm rounded-lg font-label-md transition-colors shadow-sm">
                <span className="material-symbols-outlined text-[20px]">map</span>
                View Live Map
              </Link>
            )}
          </div>
        </div>

        {/* KPI Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-lg">
          {config.kpis.includes('capacity') && (
            <div className="glass-card p-lg rounded-xl flex flex-col justify-between h-32 relative overflow-hidden">
              <div className="z-10">
                <p className="font-label-md text-on-surface-variant flex items-center gap-xs uppercase tracking-wider">
                  <span className="material-symbols-outlined text-[16px]">domain</span> Total Capacity
                </p>
                <h3 className="font-display text-display text-primary mt-sm">{metrics.total_capacity || '---'}</h3>
              </div>
              <div className="absolute right-0 bottom-0 opacity-10">
                <span className="material-symbols-outlined text-[100px]">directions_car</span>
              </div>
            </div>
          )}

          {config.kpis.includes('occupancy') && (
            <div className="glass-card p-lg rounded-xl h-32 flex flex-col justify-between relative overflow-hidden border-l-4 border-l-secondary">
              <div className="z-10">
                <p className="font-label-md text-on-surface-variant flex items-center gap-xs uppercase tracking-wider">
                  <span className="material-symbols-outlined text-[16px] text-secondary">analytics</span> Occupancy %
                </p>
                <div className="flex items-end gap-sm mt-sm">
                  <h3 className="font-display text-display text-on-surface">{metrics.current_occupancy || '---'}</h3>
                </div>
              </div>
            </div>
          )}

          {config.kpis.includes('revenue') && (
            <div className="glass-card p-lg rounded-xl h-32 flex flex-col justify-between relative overflow-hidden border-l-4 border-l-tertiary">
              <div className="z-10">
                <p className="font-label-md text-on-surface-variant flex items-center gap-xs uppercase tracking-wider">
                  <span className="material-symbols-outlined text-[16px] text-tertiary">payments</span> Revenue Today
                </p>
                <h3 className="font-display text-display text-on-surface mt-sm">{metrics.revenue_today || '---'}</h3>
              </div>
              <div className="absolute right-0 bottom-0 opacity-10">
                <span className="material-symbols-outlined text-[100px]">monetization_on</span>
              </div>
            </div>
          )}
        </div>

        {/* Main Grid: Approvals & Logs */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-lg items-start">
          
          {/* Reservation Approval Queue */}
          {config.showApprovalQueue && (
            <div className={`${config.showSecurityLogs ? 'lg:col-span-8' : 'lg:col-span-12'} bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-sm`}>
              <div className="px-lg py-md border-b border-outline-variant flex items-center justify-between">
                <h3 className="font-headline-md text-headline-md">{config.approvalLabel}</h3>
                <span className="bg-primary-container text-on-primary-container px-sm py-xs rounded-full font-label-md text-[10px]">{reservations.length} ACTIVE</span>
              </div>
              <div className="overflow-x-auto min-h-[300px]">
                {loading ? (
                  <div className="flex justify-center items-center py-20"><span className="material-symbols-outlined animate-spin text-3xl text-primary">refresh</span></div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-surface-container-low">
                      <tr>
                        <th className="px-lg py-md font-label-md text-on-surface-variant border-b border-outline-variant">VISITOR</th>
                        <th className="px-lg py-md font-label-md text-on-surface-variant border-b border-outline-variant">SLOT / TIME</th>
                        <th className="px-lg py-md font-label-md text-on-surface-variant border-b border-outline-variant text-right">ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reservations.map((r, i) => (
                        <tr key={r.id} className={`${i % 2 === 0 ? 'bg-surface' : 'bg-surface-container'} hover:bg-surface-container transition-colors group`}>
                          <td className="px-lg py-md border-b border-outline-variant">
                            <div className="flex items-center gap-sm">
                              <div className="h-8 w-8 rounded-full bg-secondary-fixed-dim flex items-center justify-center font-bold text-on-secondary-fixed">{r.name.charAt(0)}</div>
                              <div>
                                <p className="font-body-md font-semibold">{r.name}</p>
                                <p className="text-[10px] text-on-surface-variant">{r.date}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-lg py-md border-b border-outline-variant">
                            <p className="font-body-md">{r.slot}</p>
                            <p className="text-[10px] text-on-surface-variant">{r.time}</p>
                          </td>
                          <td className="px-lg py-md border-b border-outline-variant text-right">
                            <div className="flex items-center justify-end gap-sm">
                              {r.status === 'Pending' && (
                                <>
                                  <button onClick={() => handleStatusChange(r.id, 'Cancelled')} className="px-md py-xs rounded-lg border border-outline text-on-surface hover:bg-error hover:text-white hover:border-error transition-all font-label-md cursor-pointer">Reject</button>
                                  <button onClick={() => handleStatusChange(r.id, 'Confirmed')} className="px-md py-xs rounded-lg bg-primary text-on-primary hover:bg-primary-container transition-all font-label-md cursor-pointer">Approve</button>
                                </>
                              )}
                              {r.status === 'Confirmed' && (
                                <>
                                  <button onClick={() => handleStatusChange(r.id, 'No-Show')} className="px-md py-xs rounded-lg border border-outline text-on-surface hover:bg-surface-variant transition-all font-label-md cursor-pointer">No-Show</button>
                                  <button onClick={() => handleStatusChange(r.id, 'Checked-In')} className="px-md py-xs rounded-lg bg-secondary text-on-secondary hover:bg-secondary-container transition-all font-label-md cursor-pointer">Check In</button>
                                </>
                              )}
                              {r.status === 'Checked-In' && (
                                <button onClick={() => handleStatusChange(r.id, 'Completed')} className="px-md py-xs rounded-lg bg-tertiary text-on-tertiary hover:bg-tertiary-container transition-all font-label-md cursor-pointer">Complete</button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {reservations.length === 0 && (
                        <tr><td colSpan="3" className="text-center py-10 text-on-surface-variant">No active reservations</td></tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
              <Link to="/reservation-module" className="block text-center w-full py-md text-primary font-label-md hover:bg-surface-container transition-colors">
                VIEW ALL REQUESTS
              </Link>
            </div>
          )}

          {/* Security Logs Feed — Super Admin only */}
          {config.showSecurityLogs && (
            <div className="lg:col-span-4 flex flex-col gap-lg">
              <div className="bg-surface-container-highest text-on-surface rounded-xl overflow-hidden shadow-xl flex flex-col h-[500px]">
                <div className="p-lg border-b border-outline/20 flex items-center justify-between bg-surface-container-highest">
                  <div className="flex items-center gap-sm">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-error opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-error"></span>
                    </span>
                    <h3 className="font-headline-md text-headline-md text-primary">Security Logs</h3>
                  </div>
                  <span className="material-symbols-outlined text-on-surface-variant">more_vert</span>
                </div>
                
                <div className="flex-1 overflow-y-auto p-md space-y-md custom-scrollbar bg-surface-container-low">
                  {notifications.map(n => (
                    <div key={n.id} className={`p-md rounded-lg bg-surface border-l-4 ${n.type === 'error' || n.type === 'warning' ? 'border-error' : 'border-secondary'} space-y-xs`}>
                      <div className="flex items-center justify-between">
                        <span className={`font-label-md ${n.type === 'error' || n.type === 'warning' ? 'text-error' : 'text-secondary'} flex items-center gap-xs`}>
                          <span className="material-symbols-outlined text-[16px]">
                            {n.type === 'error' ? 'warning' : 'check_circle'}
                          </span> {n.title}
                        </span>
                        <span className="text-[10px] text-outline uppercase">{n.time}</span>
                      </div>
                      <p className="text-body-md">{n.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Facility Manager: Maintenance & Health Panel (instead of Security Logs) */}
          {role === 'facility_manager' && (
            <div className="lg:col-span-12 bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-sm">
              <div className="px-lg py-md border-b border-outline-variant flex items-center gap-md bg-surface-container-low">
                <span className="material-symbols-outlined text-tertiary">build</span>
                <h3 className="font-headline-md text-headline-md">Facility Health Overview</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-0 divide-y md:divide-y-0 md:divide-x divide-outline-variant">
                <div className="p-lg text-center">
                  <span className="material-symbols-outlined text-secondary text-[48px] mb-sm">verified_user</span>
                  <p className="font-label-md text-on-surface-variant uppercase tracking-wider mb-xs">Safety Status</p>
                  <h3 className="font-headline-lg text-headline-lg text-secondary">All Clear</h3>
                  <p className="text-xs text-on-surface-variant mt-1">Last inspection: 2 hours ago</p>
                </div>
                <div className="p-lg text-center">
                  <span className="material-symbols-outlined text-primary text-[48px] mb-sm">thermostat</span>
                  <p className="font-label-md text-on-surface-variant uppercase tracking-wider mb-xs">HVAC Systems</p>
                  <h3 className="font-headline-lg text-headline-lg text-primary">Operational</h3>
                  <p className="text-xs text-on-surface-variant mt-1">All 12 units running normally</p>
                </div>
                <div className="p-lg text-center">
                  <span className="material-symbols-outlined text-tertiary text-[48px] mb-sm">elevator</span>
                  <p className="font-label-md text-on-surface-variant uppercase tracking-wider mb-xs">Elevators</p>
                  <h3 className="font-headline-lg text-headline-lg text-tertiary">3/3 Online</h3>
                  <p className="text-xs text-on-surface-variant mt-1">Next maintenance: Oct 30</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}



