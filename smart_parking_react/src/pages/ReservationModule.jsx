import React, { useState, useEffect, useCallback } from 'react';
import { useAuth, authFetch } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useSocket } from '../context/SocketContext';

const roleConfig = {
  superadmin: {
    title: 'Reservation Module — All Facilities',
    subtitle: 'Create and manage reservations across every building and zone.',
    canCreate: true,
    canCancel: true,
    showOccupancy: true,
    bookingLabel: 'System Reservations',
  },
  parking_administrator: {
    title: 'Reservation Management',
    subtitle: 'Handle bookings, cancellations, and slot assignments for your facility.',
    canCreate: true,
    canCancel: true,
    showOccupancy: true,
    bookingLabel: 'Facility Bookings',
  },
  employee: {
    title: 'Book a Parking Slot',
    subtitle: 'Reserve a spot in advance for your work day. Your bookings appear below.',
    canCreate: true,
    canCancel: true,
    showOccupancy: false,
    bookingLabel: 'My Reservations',
  },
  visitor: {
    title: 'Reserve Visitor Parking',
    subtitle: 'Book a visitor parking slot before your visit.',
    canCreate: true,
    canCancel: false,
    showOccupancy: false,
    bookingLabel: 'My Booking',
  },
};

export default function ReservationModule() {
  const { user } = useAuth();
  const toast = useToast();
  const { socket } = useSocket();
  const role = user?.role || 'employee';
  const config = roleConfig[role] || roleConfig.employee;

  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [building, setBuilding] = useState('North Plaza Main');
  const [floor, setFloor] = useState('Level B1 (Premium)');
  const [guestName, setGuestName] = useState('');
  const [date, setDate] = useState('');
  const [timeSlot, setTimeSlot] = useState('09:00 - 18:00');
  
  const fetchReservations = useCallback(async () => {
    try {
      const res = await authFetch('/api/reservations');
      const payload = await res.json();
      // Handle paginated response shape: { data, total, page, pages }
      const data = Array.isArray(payload) ? payload : (payload.data || []);
      setReservations(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchReservations(); }, [fetchReservations]);

  // Real-time: auto-refresh on reservation events
  useEffect(() => {
    if (!socket) return;
    const handler = () => fetchReservations();
    socket.on('reservation:update', handler);
    return () => { socket.off('reservation:update', handler); };
  }, [socket, fetchReservations]);

  const handleCreateReservation = async () => {
    const newReservation = {
      name: guestName || (role === 'superadmin' ? 'Admin Booking' : user?.name || 'Guest User'),
      date: date || 'Today',
      time: timeSlot,
      slot: `${building.split(' ')[0]} • ${floor.split(' ')[0]}`,
      status: role === 'superadmin' ? 'Confirmed' : 'Pending',
      userId: user?.id || null,
      email: user?.email || null
    };

    try {
      const res = await authFetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newReservation)
      });
      const data = await res.json();
      if (res.ok) {
        setGuestName(''); setDate('');
        fetchReservations();
        toast.success("Reservation created successfully!");
      } else if (res.status === 409) {
        // Issue #1 — race condition: slot already taken
        toast.error(data.error || 'This slot is already reserved. Please choose another.');
      } else {
        toast.error(data.error || 'Failed to create reservation.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Network error. Please try again.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Cancel this reservation?')) return;
    try {
      const res = await authFetch(`/api/reservations/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchReservations();
        toast.success('Reservation cancelled.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const confirmedCount = reservations.filter(r => r.status === 'Confirmed').length;
  const pendingCount = reservations.filter(r => r.status === 'Pending').length;

  return (
    <>
      <div className="flex flex-col lg:flex-row gap-lg">
        {/* Left Column: Reservation Form */}
        <div className="flex-1 space-y-lg">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-headline-lg text-headline-lg text-on-surface">{config.title}</h2>
              <p className="text-body-md text-on-surface-variant">{config.subtitle}</p>
            </div>
            {config.canCreate && (
              <div className="flex items-center gap-2 bg-surface-container p-1 rounded-full border border-outline-variant">
                <button className="px-4 py-1.5 rounded-full text-label-md bg-surface shadow-sm text-primary cursor-pointer">New Booking</button>
                {role === 'superadmin' && (
                  <button className="px-4 py-1.5 rounded-full text-label-md text-on-surface-variant hover:bg-surface-container-low transition-colors cursor-pointer">Bulk Reserve</button>
                )}
              </div>
            )}
          </div>
          
          {/* Reservation Panel */}
          {config.canCreate && (
            <div className="bg-surface rounded-xl border border-outline-variant shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.05)] overflow-hidden">
              <div className="p-lg border-b border-outline-variant flex flex-col md:flex-row md:items-center justify-between gap-md">
                <div className="flex items-center gap-md">
                  <div className="bg-primary-container p-2 rounded-lg text-on-primary-container">
                    <span className="material-symbols-outlined">event_note</span>
                  </div>
                  <div>
                    <h3 className="font-headline-md text-headline-md">Reserve a Slot</h3>
                    <p className="text-on-surface-variant font-body-md">
                      {role === 'superadmin' ? 'Book on behalf of any user or facility.' : 'Configure your parking requirements below.'}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="p-lg grid grid-cols-1 md:grid-cols-2 gap-lg">
                {role === 'superadmin' && (
                  <div className="space-y-sm md:col-span-2">
                    <label className="font-label-md text-label-md text-on-surface">Guest / Employee Name</label>
                    <input
                      value={guestName} onChange={e => setGuestName(e.target.value)}
                      className="w-full h-12 bg-surface border border-outline-variant rounded-lg px-md focus:border-primary outline-none"
                      placeholder="Enter name for the booking..."
                    />
                  </div>
                )}
                <div className="space-y-sm">
                  <label className="font-label-md text-label-md text-on-surface">Building Location</label>
                  <select 
                    value={building} onChange={e => setBuilding(e.target.value)}
                    className="w-full h-12 bg-surface border border-outline-variant rounded-lg px-md appearance-none focus:border-primary outline-none"
                  >
                    <option>North Plaza Main</option>
                    <option>East Wing Terminal</option>
                    <option>Underground Annex</option>
                  </select>
                </div>
                <div className="space-y-sm">
                  <label className="font-label-md text-label-md text-on-surface">Floor / Zone</label>
                  <select 
                    value={floor} onChange={e => setFloor(e.target.value)}
                    className="w-full h-12 bg-surface border border-outline-variant rounded-lg px-md appearance-none focus:border-primary outline-none"
                  >
                    <option>Level B1 (Premium)</option>
                    <option>Level B2 (Standard)</option>
                    <option>Level B3 (Long Term)</option>
                    <option>Rooftop Terrace</option>
                  </select>
                </div>
                <div className="space-y-sm">
                  <label className="font-label-md text-label-md text-on-surface">Date</label>
                  <input
                    value={date} onChange={e => setDate(e.target.value)}
                    className="w-full h-12 bg-surface border border-outline-variant rounded-lg px-md focus:border-primary outline-none"
                    type="date"
                  />
                </div>
                <div className="space-y-sm">
                  <label className="font-label-md text-label-md text-on-surface">Time Slot</label>
                  <select 
                    value={timeSlot} onChange={e => setTimeSlot(e.target.value)}
                    className="w-full h-12 bg-surface border border-outline-variant rounded-lg px-md appearance-none focus:border-primary outline-none"
                  >
                    <option>09:00 - 18:00</option>
                    <option>06:00 - 14:00</option>
                    <option>14:00 - 22:00</option>
                    <option>22:00 - 06:00</option>
                  </select>
                </div>
              </div>
              
              <div className="p-lg bg-surface-container-low border-t border-outline-variant flex justify-end">
                <button 
                  onClick={handleCreateReservation}
                  className="bg-primary text-white px-xl py-3 rounded-lg font-label-md text-label-md hover:bg-on-primary-fixed-variant transition-colors shadow-sm flex items-center gap-2 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[20px]">check_circle</span>
                  {role === 'superadmin' ? 'Confirm & Assign' : 'Confirm Reservation'}
                </button>
              </div>
            </div>
          )}
        </div>
        
        {/* Right Column: Current Bookings */}
        <div className="lg:w-[400px] space-y-lg">
          <div className="flex items-center justify-between">
            <h2 className="font-headline-lg text-headline-lg text-on-surface">{config.bookingLabel}</h2>
            <div className="flex items-center gap-sm">
              <span className="bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded text-[10px] font-bold">{confirmedCount} Confirmed</span>
              {pendingCount > 0 && <span className="bg-tertiary-container text-on-tertiary-container px-2 py-0.5 rounded text-[10px] font-bold">{pendingCount} Pending</span>}
            </div>
          </div>
          
          <div className="space-y-md">
            {loading ? (
              <div className="flex justify-center py-10"><span className="material-symbols-outlined animate-spin text-primary text-3xl">refresh</span></div>
            ) : reservations.length === 0 ? (
              <div className="text-on-surface-variant text-center py-8">No current bookings.</div>
            ) : (
              reservations.map(res => (
                <div key={res.id} className="bg-surface p-lg rounded-xl border border-outline-variant shadow-sm hover:shadow-md transition-shadow group">
                  <div className="flex justify-between items-start mb-md">
                    <div className="flex items-center gap-sm">
                      <div className="bg-primary-container/10 text-primary p-1.5 rounded-lg">
                        <span className="material-symbols-outlined text-[20px]">local_parking</span>
                      </div>
                      <div>
                        <p className="font-headline-md text-[16px] leading-tight text-on-surface">{res.slot}</p>
                        <p className="text-[12px] text-on-surface-variant">{res.name}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                      res.status === 'Confirmed' ? 'bg-secondary-container text-on-secondary-fixed-variant' : 
                      res.status === 'Checked-In' ? 'bg-tertiary-container text-on-tertiary-fixed-variant' : 
                      res.status === 'Completed' ? 'bg-surface-container-highest text-on-surface' :
                      'bg-surface-container-highest text-on-surface-variant'
                    }`}>
                      {res.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-md text-on-surface-variant font-body-md text-sm mb-lg">
                    <div className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[18px]">calendar_today</span>
                      <span>{res.date}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[18px]">schedule</span>
                      <span>{res.time}</span>
                    </div>
                  </div>
                  {config.canCancel && (
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleDelete(res.id)} className="flex-1 py-2 bg-error/10 text-error rounded-lg font-label-md text-label-md hover:bg-error/20 transition-colors cursor-pointer">
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
            
            {/* Occupancy Card */}
            {config.showOccupancy && (
              <div className="bg-primary text-white p-lg rounded-xl shadow-lg relative overflow-hidden">
                <div className="absolute -right-4 -bottom-4 opacity-10">
                  <span className="material-symbols-outlined text-[120px]">directions_car</span>
                </div>
                <h4 className="font-label-md text-label-md mb-2 opacity-80 uppercase tracking-widest">Occupancy Load</h4>
                <div className="flex items-end justify-between">
                  <p className="text-[32px] font-black leading-none">84%</p>
                  <div className="text-right">
                    <p className="font-label-md text-label-md">12 Slots Remaining</p>
                    <p className="text-[10px] opacity-70">Zone: North Plaza</p>
                  </div>
                </div>
                <div className="mt-4 h-1.5 bg-white/20 rounded-full overflow-hidden">
                  <div className="h-full bg-secondary-container w-[84%]"></div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}





