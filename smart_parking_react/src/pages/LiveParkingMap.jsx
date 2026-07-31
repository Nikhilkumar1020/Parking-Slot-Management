import React, { useState, useEffect, useCallback } from 'react';
import { useAuth, authFetch } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

export default function LiveParkingMap() {
  const { user } = useAuth();
  const { socket } = useSocket();
  const role = user?.role || 'security_officer';
  const isAdmin = role === 'superadmin' || role === 'parking_administrator';
  
  const [showDetails, setShowDetails] = useState(false);
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  // AI mode state
  const [aiMode, setAiMode] = useState(false);                    // true = AI-sourced
  const [aiOccupancy, setAiOccupancy] = useState({});             // {slotId: 'Occupied'|'Available'}
  const [lastAiUpdate, setLastAiUpdate] = useState(null);

  const fetchSlots = useCallback(() => {
    authFetch('/api/slots')
      .then(res => res.json())
      .then(data => setSlots(data))
      .catch(err => console.error(err));
  }, []);

  useEffect(() => { fetchSlots(); }, [fetchSlots]);

  // Real-time: auto-refresh on manual slot events
  useEffect(() => {
    if (!socket) return;
    const handler = () => fetchSlots();
    socket.on('slot:update', handler);
    return () => { socket.off('slot:update', handler); };
  }, [socket, fetchSlots]);

  // Real-time: AI occupancy updates
  useEffect(() => {
    if (!socket) return;
    const handler = (data) => {
      setAiOccupancy(data.slots || {});
      setLastAiUpdate(data);
      if (!aiMode) setAiMode(true); // auto-enable AI mode on first AI event
    };
    socket.on('ai:occupancy-update', handler);
    return () => { socket.off('ai:occupancy-update', handler); };
  }, [socket, aiMode]);

  const handleSlotClick = (slot) => {
    setSelectedSlot(slot);
    setShowDetails(true);
  };

  const renderSlot = (slot) => {
    // In AI mode, override status from AI occupancy data when available
    const effectiveStatus = (aiMode && aiOccupancy[slot.slotId]) ? aiOccupancy[slot.slotId] : slot.status;
    const isOccupied = effectiveStatus === 'Occupied';
    const isEV = slot.type === 'EV';
    const isAIOverride = aiMode && aiOccupancy[slot.slotId];
    return (
      <div 
        key={slot.id} 
        onClick={() => handleSlotClick(slot)}
        className={`w-24 h-40 border-2 ${isOccupied ? 'border-error bg-error/10' : 'border-secondary bg-secondary/10'} rounded-lg flex flex-col items-center justify-center cursor-pointer hover:opacity-80 transition-opacity m-2 relative`}
      >
        <span className="font-bold text-on-surface mb-2">{slot.slotId}</span>
        {isOccupied && (
          <span className="material-symbols-outlined text-error text-4xl">directions_car</span>
        )}
        {isEV && (
          <span className="material-symbols-outlined text-tertiary absolute top-1 right-1 text-sm">ev_station</span>
        )}
        {isAIOverride && (
          <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[9px] font-bold text-primary bg-primary/10 px-1 rounded">AI</span>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Controls Layer */}
      <div className="absolute top-4 left-4 right-4 z-10 flex flex-col gap-4">
        <div className="glass-panel p-2 rounded-xl border border-outline-variant shadow-sm flex items-center justify-between overflow-x-auto whitespace-nowrap">
          <div className="flex gap-2 p-1 bg-surface-container-low rounded-lg">
            <button className="px-6 py-1.5 bg-primary text-on-primary rounded-md font-label-md text-label-md shadow-md transition-all cursor-pointer">North Terminal</button>
            <button className="px-6 py-1.5 hover:bg-surface-container text-on-surface-variant rounded-md font-label-md text-label-md transition-all cursor-pointer">South Plaza</button>
            <button className="px-6 py-1.5 hover:bg-surface-container text-on-surface-variant rounded-md font-label-md text-label-md transition-all cursor-pointer">East Wing</button>
          </div>
          <div className="h-6 w-px bg-outline-variant mx-4"></div>
          {/* AI Mode Toggle */}
          <div className="flex items-center gap-2 mr-4">
            <button
              onClick={() => setAiMode(m => !m)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-label-md font-label-md border transition-all cursor-pointer ${aiMode ? 'bg-primary text-on-primary border-primary shadow-md' : 'bg-surface text-on-surface-variant border-outline-variant hover:border-primary'}`}
            >
              <span className="material-symbols-outlined text-[16px]">smart_toy</span>
              {aiMode ? 'AI Mode' : 'Manual'}
            </button>
            {aiMode && lastAiUpdate && (
              <span className="text-[11px] text-secondary animate-pulse font-bold">● LIVE</span>
            )}
          </div>
          <div className="flex gap-4 pr-4">
            <button className="w-10 h-10 flex items-center justify-center rounded-full border border-primary text-primary font-bold cursor-pointer">B1</button>
            <button className="w-10 h-10 flex items-center justify-center rounded-full border border-outline-variant text-on-surface-variant cursor-pointer">L1</button>
            <button className="w-10 h-10 flex items-center justify-center rounded-full border border-outline-variant text-on-surface-variant cursor-pointer">L2</button>
          </div>
        </div>
        {/* Legend */}
        <div className="self-start glass-panel p-3 rounded-lg border border-outline-variant shadow-sm flex gap-6">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-secondary"></div>
            <span className="text-label-md font-label-md text-on-surface-variant">Available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-error"></div>
            <span className="text-label-md font-label-md text-on-surface-variant">Occupied</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px] text-tertiary">ev_station</span>
            <span className="text-label-md font-label-md text-on-surface-variant">EV Only</span>
          </div>
        </div>
      </div>

      {/* Map Area */}
      <div className="w-full h-full pt-32 p-4 md:p-8 overflow-auto flex items-center justify-center bg-surface-dim relative">
        <div className="absolute inset-0 pointer-events-none opacity-20" style={{ backgroundImage: "radial-gradient(#004ac6 1px, transparent 0)", backgroundSize: "40px 40px" }}></div>
        <div className="relative bg-surface p-12 rounded-2xl shadow-2xl border-4 border-outline-variant/30 min-w-[800px]">
          <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none flex items-center justify-center font-black text-9xl">LEVEL B1</div>
          
          <div className="flex flex-col gap-12">
            {/* Top Row Slots */}
            <div className="flex justify-between border-b-4 border-dashed border-outline-variant pb-8">
              <div className="flex w-full justify-around flex-wrap">
                {slots.slice(0, Math.ceil(slots.length / 2)).map(renderSlot)}
              </div>
            </div>
            
            {/* Central Drive Way */}
            <div className="h-32 bg-slate-100 flex items-center justify-center relative rounded-md border-y-2 border-slate-200">
              <div className="flex gap-16">
                <div className="w-12 h-1 bg-white opacity-50"></div>
                <div className="w-12 h-1 bg-white opacity-50"></div>
                <div className="w-12 h-1 bg-white opacity-50"></div>
                <div className="w-12 h-1 bg-white opacity-50"></div>
              </div>
              <span className="absolute right-4 bottom-2 text-slate-400 font-bold tracking-widest text-xs">ONE WAY -&gt;</span>
            </div>
            
            {/* Bottom Row Slots */}
            <div className="flex justify-between border-t-4 border-dashed border-outline-variant pt-8">
              <div className="flex w-full justify-around flex-wrap">
                {slots.slice(Math.ceil(slots.length / 2)).map(renderSlot)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Detail Popup (Floating Bottom Right) */}
      <div className={`fixed bottom-20 md:bottom-8 right-4 w-72 md:w-80 glass-panel rounded-2xl border border-outline-variant shadow-2xl transition-transform duration-500 z-30 overflow-hidden ${showDetails ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="h-24 relative">
          <img className="w-full h-full object-cover" alt="Car" src="https://images.unsplash.com/photo-1560958089-b8a1929cea89?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"/>
          <button className="absolute top-2 right-2 w-8 h-8 bg-black/30 backdrop-blur rounded-full text-white flex items-center justify-center cursor-pointer hover:bg-black/50 transition-colors" onClick={() => setShowDetails(false)}>
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
        <div className="p-lg">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="font-headline-lg text-headline-lg text-on-surface">{selectedSlot?.slot_number}</h2>
              <span className="inline-block px-2 py-0.5 mt-1 rounded text-[10px] uppercase font-bold tracking-wider">{selectedSlot?.status}</span>
            </div>
            {selectedSlot?.type === 'EV' && (
              <div className="text-primary">
                <span className="material-symbols-outlined text-[32px]">ev_station</span>
              </div>
            )}
          </div>
          <div className="space-y-3">
            <div className="flex justify-between text-body-md">
              <span className="text-on-surface-variant">Vehicle:</span>
              <span className="font-bold text-on-surface">{selectedSlot?.status === 'Occupied' ? 'Registered' : 'None'}</span>
            </div>
            <div className="flex justify-between text-body-md">
              <span className="text-on-surface-variant">Type:</span>
              <span className="font-bold text-on-surface">{selectedSlot?.type}</span>
            </div>
          </div>
          <div className="mt-6 flex gap-2">
            {isAdmin ? (
              <>
                <button className="flex-1 py-2.5 bg-primary text-on-primary rounded-lg font-label-md text-label-md hover:bg-on-primary-fixed-variant transition-colors cursor-pointer">Manage Slot</button>
                <button className="p-2.5 border border-outline-variant text-on-surface-variant rounded-lg hover:bg-surface-container transition-colors cursor-pointer">
                  <span className="material-symbols-outlined">more_vert</span>
                </button>
              </>
            ) : (
              <button className="flex-1 py-2.5 bg-primary text-on-primary rounded-lg font-label-md text-label-md hover:bg-on-primary-fixed-variant transition-colors cursor-pointer">
                {role === 'security_officer' ? 'Flag for Review' : 'View Details'}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}



