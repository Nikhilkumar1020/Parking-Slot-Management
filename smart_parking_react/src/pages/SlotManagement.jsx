import React, { useState, useEffect, useCallback } from 'react';
import { useAuth, authFetch } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useSocket } from '../context/SocketContext';

const roleConfig = {
  superadmin: {
    title: 'Slot Management — System Wide',
    subtitle: 'Full control over all facility slots. Create, delete, and toggle status.',
    canCreate: true,
    canDelete: true,
    canToggle: true,
    canBulkImport: true,
    showFilters: true,
  },
  parking_administrator: {
    title: 'Parking Slot Control',
    subtitle: 'Manage slot availability, block/release, and track occupancy.',
    canCreate: true,
    canDelete: false,
    canToggle: true,
    canBulkImport: true,
    showFilters: true,
  },
};

export default function SlotManagement() {
  const { user } = useAuth();
  const toast = useToast();
  const { socket } = useSocket();
  const role = user?.role || 'parking_administrator';
  const config = roleConfig[role] || roleConfig.parking_administrator;

  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const fetchSlots = useCallback(async () => {
    try {
      const res = await authFetch('/api/slots');
      if (!res.ok) throw new Error('Failed to fetch slots');
      const data = await res.json();
      setSlots(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSlots(); }, [fetchSlots]);

  // Real-time: auto-refresh on slot events
  useEffect(() => {
    if (!socket) return;
    const handler = () => fetchSlots();
    socket.on('slot:update', handler);
    return () => { socket.off('slot:update', handler); };
  }, [socket, fetchSlots]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'Available': return 'bg-primary-container text-on-primary-container';
      case 'Occupied': return 'bg-error-container text-on-error-container';
      case 'Reserved': return 'bg-secondary-container text-on-secondary-container';
      case 'Maintenance': return 'bg-surface-container text-on-surface-variant';
      default: return 'bg-surface-container text-on-surface';
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'VIP': return 'stars';
      case 'EV': return 'ev_station';
      case 'Disabled': return 'accessible';
      case 'Bike': return 'moped';
      default: return 'directions_car';
    }
  };

  const handleCreateSlot = async () => {
    const newSlot = {
      slotId: `NEW-${Math.floor(Math.random() * 1000)}`,
      level: 'Level 1',
      type: 'Standard',
      status: 'Available',
      occupancy: 0,
      lastEvent: 'Just now'
    };

    try {
      const res = await authFetch('/api/slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSlot)
      });
      if (res.ok) fetchSlots();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteSlot = async (id) => {
    if (!window.confirm('Are you sure you want to delete this slot?')) return;
    try {
      const res = await fetch(`/api/slots/${id}`, { method: 'DELETE' });
      if (res.ok) fetchSlots();
    } catch (err) {
      console.error(err);
    }
  };

  const toggleStatus = async (slot) => {
    const nextStatus = slot.status === 'Available' ? 'Occupied' : 'Available';
    try {
      const res = await fetch(`/api/slots/${slot.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus, occupancy: nextStatus === 'Occupied' ? 100 : 0 })
      });
      if (res.ok) fetchSlots();
    } catch (err) {
      console.error(err);
    }
  };

  const filteredSlots = slots.filter(slot => {
    const matchesFilter = filter === 'all' || slot.status === filter;
    const matchesSearch = search === '' || slot.slotId?.toLowerCase().includes(search.toLowerCase()) || slot.level?.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const statusCounts = {
    Available: slots.filter(s => s.status === 'Available').length,
    Occupied: slots.filter(s => s.status === 'Occupied').length,
    Maintenance: slots.filter(s => s.status === 'Maintenance').length,
  };

  return (
    <>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-md mb-xl">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-on-surface mb-xs">{config.title}</h2>
          <p className="font-body-md text-body-md text-on-surface-variant">{config.subtitle}</p>
        </div>
        <div className="flex items-center gap-md">
          {config.canBulkImport && (
            <button className="flex items-center gap-sm px-lg py-2 border border-outline-variant text-primary font-label-md text-label-md rounded-lg hover:bg-surface-container-low transition-colors cursor-pointer">
              <span className="material-symbols-outlined text-[18px]">upload_file</span>
              Bulk Import
            </button>
          )}
          {config.canCreate && (
            <button 
              onClick={handleCreateSlot}
              className="flex items-center gap-sm px-lg py-2 bg-primary text-on-primary font-label-md text-label-md rounded-lg hover:brightness-90 transition-all shadow-md cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              Create New Slot
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      {config.showFilters && (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md mb-lg flex flex-wrap items-center gap-md">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline">search</span>
              <input 
                value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-surface-container rounded-lg border-none focus:ring-2 focus:ring-primary text-body-md outline-none" 
                placeholder="Search by Slot ID or Section..." type="text" 
              />
            </div>
          </div>
          <div className="flex items-center gap-sm overflow-x-auto pb-1 md:pb-0">
            <button onClick={() => setFilter('all')} className={`px-md py-1.5 rounded-full text-label-md font-label-md border cursor-pointer transition-colors ${filter === 'all' ? 'bg-primary-fixed text-on-primary-fixed-variant border-primary-fixed' : 'bg-surface text-on-surface-variant border-outline-variant hover:bg-surface-container-high'}`}>
              All ({slots.length})
            </button>
            <button onClick={() => setFilter('Available')} className={`px-md py-1.5 rounded-full text-label-md font-label-md border cursor-pointer transition-colors ${filter === 'Available' ? 'bg-primary-fixed text-on-primary-fixed-variant border-primary-fixed' : 'bg-surface text-on-surface-variant border-outline-variant hover:bg-surface-container-high'}`}>
              Available ({statusCounts.Available})
            </button>
            <button onClick={() => setFilter('Occupied')} className={`px-md py-1.5 rounded-full text-label-md font-label-md border cursor-pointer transition-colors ${filter === 'Occupied' ? 'bg-primary-fixed text-on-primary-fixed-variant border-primary-fixed' : 'bg-surface text-on-surface-variant border-outline-variant hover:bg-surface-container-high'}`}>
              Occupied ({statusCounts.Occupied})
            </button>
            <button onClick={() => setFilter('Maintenance')} className={`px-md py-1.5 rounded-full text-label-md font-label-md border cursor-pointer transition-colors ${filter === 'Maintenance' ? 'bg-primary-fixed text-on-primary-fixed-variant border-primary-fixed' : 'bg-surface text-on-surface-variant border-outline-variant hover:bg-surface-container-high'}`}>
              Maintenance ({statusCounts.Maintenance})
            </button>
          </div>
        </div>
      )}

      {/* Slots Grid */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <span className="material-symbols-outlined animate-spin text-primary text-4xl">refresh</span>
        </div>
      ) : error ? (
        <div className="p-4 bg-error text-on-error rounded-lg">Error loading slots: {error}</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-lg">
          {filteredSlots.map(slot => (
            <div key={slot.id} className="slot-card bg-surface-container-lowest border border-outline-variant rounded-xl p-lg flex flex-col gap-md relative group">
              
              {config.canDelete && (
                <button 
                  onClick={() => handleDeleteSlot(slot.id)}
                  className="absolute top-2 right-2 p-1 bg-surface-container rounded-full text-error opacity-0 group-hover:opacity-100 transition-opacity z-10 cursor-pointer hover:bg-error/10"
                >
                  <span className="material-symbols-outlined text-[16px]">delete</span>
                </button>
              )}

              <div className="flex justify-between items-start">
                <div className="flex items-center gap-sm">
                  <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center">
                    <span className="material-symbols-outlined text-primary">{getIcon(slot.type)}</span>
                  </div>
                  <div>
                    <h4 className="font-headline-md text-headline-md text-on-surface leading-tight">{slot.slotId}</h4>
                    <span className="font-label-md text-label-md text-on-surface-variant">{slot.level} • {slot.type}</span>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded font-label-md text-[10px] uppercase tracking-wider ${getStatusColor(slot.status)}`}>
                  {slot.status}
                </span>
              </div>
              
              <div className="flex flex-col gap-xs py-sm border-y border-outline-variant/30 min-h-[72px] justify-center">
                {slot.status === 'Occupied' && (
                  <>
                    <div className="flex justify-between text-body-md">
                      <span className="text-on-surface-variant">Vehicle</span>
                      <span className="font-semibold text-on-surface">{slot.vehiclePlate || 'Unknown'}</span>
                    </div>
                    <div className="flex justify-between text-body-md">
                      <span className="text-on-surface-variant">Duration</span>
                      <span className="text-on-surface">{slot.duration || '0m'}</span>
                    </div>
                  </>
                )}
                
                {slot.status === 'Available' && (
                  <>
                    <div className="flex justify-between text-body-md">
                      <span className="text-on-surface-variant">Occupancy</span>
                      <span className="font-semibold text-secondary">{slot.occupancy}%</span>
                    </div>
                    <div className="flex justify-between text-body-md">
                      <span className="text-on-surface-variant">Last Event</span>
                      <span className="text-on-surface">{slot.lastEvent || 'N/A'}</span>
                    </div>
                  </>
                )}
                
                {slot.status === 'Reserved' && (
                  <>
                    <div className="flex justify-between text-body-md">
                      <span className="text-on-surface-variant">Reserved By</span>
                      <span className="font-semibold text-on-surface">{slot.reservedBy || 'Anonymous'}</span>
                    </div>
                    <div className="flex justify-between text-body-md">
                      <span className="text-on-surface-variant">ETA</span>
                      <span className="text-on-surface">{slot.eta || 'Unknown'}</span>
                    </div>
                  </>
                )}

                {slot.status === 'Maintenance' && (
                  <>
                    <div className="flex justify-between text-body-md">
                      <span className="text-on-surface-variant">Issue</span>
                      <span className="font-semibold text-error">{slot.issue || 'Pending check'}</span>
                    </div>
                    <div className="flex justify-between text-body-md">
                      <span className="text-on-surface-variant">Schedule</span>
                      <span className="text-on-surface">{slot.schedule || 'Unscheduled'}</span>
                    </div>
                  </>
                )}
              </div>
              
              <div className="flex items-center gap-sm mt-auto">
                <button className="flex-1 py-2 text-primary font-label-md text-label-md hover:bg-primary-container/10 rounded-lg border border-transparent hover:border-primary-fixed transition-all cursor-pointer">
                  Details
                </button>
                {config.canToggle && (
                  <button 
                    onClick={() => toggleStatus(slot)}
                    className={`flex-1 py-2 font-label-md text-label-md rounded-lg transition-all cursor-pointer ${
                      slot.status === 'Available' 
                        ? 'text-on-surface-variant hover:bg-surface-container' 
                        : 'bg-error/5 text-error hover:bg-error/10'
                    }`}
                  >
                    {slot.status === 'Available' ? 'Block' : 'Release'}
                  </button>
                )}
              </div>
            </div>
          ))}

          {config.canCreate && (
            <button 
              onClick={handleCreateSlot}
              className="border-2 border-dashed border-outline-variant rounded-xl p-lg flex flex-col items-center justify-center gap-sm text-on-surface-variant hover:border-primary hover:text-primary transition-all group bg-surface/30 cursor-pointer min-h-[220px]"
            >
              <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center group-hover:bg-primary-container/20 transition-colors">
                <span className="material-symbols-outlined">add</span>
              </div>
              <span className="font-label-md text-label-md">Add New Slot</span>
            </button>
          )}
        </div>
      )}
    </>
  );
}




