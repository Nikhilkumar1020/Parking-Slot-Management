import React, { useState, useEffect, useCallback } from 'react';
import { useAuth, authFetch } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

const roleConfig = {
  superadmin: {
    title: 'Reports & Analytics — System Wide',
    subtitle: 'Complete performance metrics across all facilities.',
    tabs: ['Occupancy', 'Revenue', 'Users', 'Facilities'],
    showRevenue: true,
    showUserMetrics: true,
    showFacilityMetrics: true,
  },
  facility_manager: {
    title: 'Facility Reports',
    subtitle: 'Performance and utilization reports for your facility.',
    tabs: ['Occupancy', 'Revenue', 'Maintenance'],
    showRevenue: true,
    showUserMetrics: false,
    showFacilityMetrics: false,
  },
};

export default function ReportsAnalytics() {
  const { user } = useAuth();
  const { socket } = useSocket();
  const role = user?.role || 'facility_manager';
  const config = roleConfig[role] || roleConfig.facility_manager;

  const [metrics, setMetrics] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(config.tabs[0]);

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await authFetch('/api/metrics');
      const data = await res.json();
      const metricsMap = {};
      data.forEach(m => {
        metricsMap[m.key] = m.value;
      });
      setMetrics(metricsMap);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMetrics(); }, [fetchMetrics]);

  // Real-time: auto-refresh on metric events
  useEffect(() => {
    if (!socket) return;
    const handler = () => fetchMetrics();
    socket.on('metric:update', handler);
    return () => { socket.off('metric:update', handler); };
  }, [socket, fetchMetrics]);

  const tabIcons = {
    Occupancy: 'donut_large',
    Revenue: 'payments',
    Users: 'group',
    Facilities: 'domain',
    Maintenance: 'build',
  };

  return (
    <>
      <header className="sticky top-0 w-full bg-surface border-b border-outline-variant shadow-sm z-40 flex items-center justify-between px-lg h-16 transition-colors duration-200">
        <div className="flex items-center gap-md">
          <h2 className="font-headline-md text-headline-md font-bold text-primary">{config.title}</h2>
        </div>
        <div className="flex items-center gap-md">
          <button onClick={fetchMetrics} className="hidden md:flex items-center gap-xs px-md py-sm bg-primary text-white rounded-lg hover:bg-primary-container transition-colors shadow-sm cursor-pointer">
            <span className="material-symbols-outlined text-[18px]">refresh</span>
            <span className="font-label-md text-label-md">Refresh Data</span>
          </button>
        </div>
      </header>
      
      <div className="p-lg space-y-lg max-w-[1440px] mx-auto">
        {/* Tab Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-md bg-surface p-md rounded-xl border border-outline-variant shadow-sm">
          <div className="flex items-center gap-xs overflow-x-auto custom-scrollbar whitespace-nowrap pb-1 lg:pb-0">
            {config.tabs.map(tab => (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-md py-sm rounded-lg flex items-center gap-xs cursor-pointer transition-colors ${
                  activeTab === tab 
                    ? 'bg-primary-fixed text-on-primary-fixed font-bold' 
                    : 'text-on-surface-variant hover:bg-surface-container-low'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">{tabIcons[tab] || 'analytics'}</span>
                {tab}
              </button>
            ))}
          </div>
          <p className="text-sm text-on-surface-variant">{config.subtitle}</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><span className="material-symbols-outlined animate-spin text-5xl text-primary">refresh</span></div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-lg">
            {/* Main Chart Area */}
            <div className="lg:col-span-8 bg-surface rounded-xl border border-outline-variant p-lg shadow-sm flex flex-col items-center justify-center min-h-[400px]">
              <div className="text-center space-y-md w-full">
                <span className="material-symbols-outlined text-[64px] text-primary">insert_chart</span>
                <h3 className="font-headline-lg text-headline-lg">
                  {activeTab === 'Occupancy' && 'Monthly Occupancy Trend'}
                  {activeTab === 'Revenue' && 'Revenue Breakdown'}
                  {activeTab === 'Users' && 'User Activity Overview'}
                  {activeTab === 'Facilities' && 'Facility Utilization'}
                  {activeTab === 'Maintenance' && 'Maintenance Schedule'}
                </h3>
                <p className="font-body-lg text-on-surface-variant">
                  {activeTab === 'Occupancy' && `Active Sessions: ${metrics.active_sessions || '---'}`}
                  {activeTab === 'Revenue' && `Today's Revenue: ${metrics.revenue_today || '---'}`}
                  {activeTab === 'Users' && 'Total registered users and their parking patterns'}
                  {activeTab === 'Facilities' && 'Cross-facility comparison data'}
                  {activeTab === 'Maintenance' && 'Equipment servicing and inspection timeline'}
                </p>
                <div className="flex items-end justify-center gap-2 pt-8 h-48">
                  {activeTab === 'Occupancy' && [40, 60, 45, 80, 55, 90, 75].map((h, i) => (
                    <div key={i} className="w-12 bg-primary rounded-t-md hover:bg-primary-container transition-colors cursor-pointer" style={{ height: `${h}%` }}></div>
                  ))}
                  {activeTab === 'Revenue' && [55, 70, 40, 85, 65, 75, 90].map((h, i) => (
                    <div key={i} className="w-12 bg-secondary rounded-t-md hover:bg-secondary-container transition-colors cursor-pointer" style={{ height: `${h}%` }}></div>
                  ))}
                  {activeTab === 'Users' && [30, 50, 70, 45, 80, 60, 55].map((h, i) => (
                    <div key={i} className="w-12 bg-tertiary rounded-t-md hover:bg-tertiary-container transition-colors cursor-pointer" style={{ height: `${h}%` }}></div>
                  ))}
                  {activeTab === 'Facilities' && [65, 80, 50, 90, 45, 70, 85].map((h, i) => (
                    <div key={i} className="w-12 bg-primary rounded-t-md hover:bg-primary-container transition-colors cursor-pointer" style={{ height: `${h}%` }}></div>
                  ))}
                  {activeTab === 'Maintenance' && [20, 40, 60, 35, 50, 45, 30].map((h, i) => (
                    <div key={i} className="w-12 bg-error/70 rounded-t-md hover:bg-error/40 transition-colors cursor-pointer" style={{ height: `${h}%` }}></div>
                  ))}
                </div>
              </div>
            </div>

            {/* Sidebar Metrics */}
            <div className="lg:col-span-4 space-y-lg">
              {config.showRevenue && (
                <div className="bg-surface rounded-xl border border-outline-variant p-lg shadow-sm text-center">
                  <span className="material-symbols-outlined text-secondary text-[48px] mb-sm">payments</span>
                  <p className="font-label-md text-on-surface-variant uppercase tracking-wider mb-xs">Today's Revenue</p>
                  <h2 className="font-display text-[42px] leading-none text-on-surface">{metrics.revenue_today || '$0'}</h2>
                </div>
              )}
              <div className="bg-surface rounded-xl border border-outline-variant p-lg shadow-sm text-center">
                <span className="material-symbols-outlined text-tertiary text-[48px] mb-sm">pie_chart</span>
                <p className="font-label-md text-on-surface-variant uppercase tracking-wider mb-xs">Occupancy Rate</p>
                <h2 className="font-display text-[42px] leading-none text-on-surface">{metrics.current_occupancy || '0%'}</h2>
              </div>
              <div className="bg-surface rounded-xl border border-outline-variant p-lg shadow-sm text-center">
                <span className="material-symbols-outlined text-primary text-[48px] mb-sm">directions_car</span>
                <p className="font-label-md text-on-surface-variant uppercase tracking-wider mb-xs">Total Capacity</p>
                <h2 className="font-display text-[42px] leading-none text-on-surface">{metrics.total_capacity || '0'}</h2>
              </div>

              {/* Super Admin only: User metrics */}
              {config.showUserMetrics && (
                <div className="bg-surface rounded-xl border border-outline-variant p-lg shadow-sm text-center">
                  <span className="material-symbols-outlined text-primary text-[48px] mb-sm">group</span>
                  <p className="font-label-md text-on-surface-variant uppercase tracking-wider mb-xs">Registered Users</p>
                  <h2 className="font-display text-[42px] leading-none text-on-surface">{metrics.total_users || '24'}</h2>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}


