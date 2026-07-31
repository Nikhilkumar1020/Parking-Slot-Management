import React, { useState, useEffect, useCallback } from 'react';
import { useAuth, authFetch } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useSocket } from '../context/SocketContext';

const roleConfig = {
  superadmin: {
    title: 'Vehicle Registry — All Vehicles',
    subtitle: 'Full fleet management across all facilities.',
    canRegister: true,
    canDelete: true,
    canVerify: true,
    showHistory: true,
  },
  facility_manager: {
    title: 'Facility Vehicle Registry',
    subtitle: 'Oversee and verify vehicles registered to your facility.',
    canRegister: false,
    canDelete: true,
    canVerify: true,
    showHistory: true,
  },
  parking_administrator: {
    title: 'Parking Vehicle Log',
    subtitle: 'Track vehicles currently in the parking system.',
    canRegister: true,
    canDelete: true,
    canVerify: false,
    showHistory: true,
  },
  employee: {
    title: 'My Vehicles',
    subtitle: 'Manage your personal registered vehicles for automated gate access.',
    canRegister: true,
    canDelete: true,
    canVerify: false,
    showHistory: false,
  },
};

export default function VehicleManagement() {
  const { user } = useAuth();
  const toast = useToast();
  const { socket } = useSocket();
  const role = user?.role || 'employee';
  const config = roleConfig[role] || roleConfig.employee;

  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [color, setColor] = useState('');
  const [plate, setPlate] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  const fetchVehicles = useCallback(async () => {
    try {
      const res = await authFetch('/api/vehicles');
      if (!res.ok) throw new Error('Failed to fetch vehicles');
      const data = await res.json();
      setVehicles(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchVehicles(); }, [fetchVehicles]);

  // Real-time: auto-refresh on vehicle events
  useEffect(() => {
    if (!socket) return;
    const handler = () => fetchVehicles();
    socket.on('vehicle:update', handler);
    return () => { socket.off('vehicle:update', handler); };
  }, [socket, fetchVehicles]);

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!plate || !make || !model) return toast.success("Please fill in required fields");

    const newVehicle = {
      make, model,
      color: color !== 'Select Color' ? color : 'Unknown',
      plate,
      status: role === 'superadmin' || role === 'parking_administrator' ? 'VERIFIED' : 'PENDING',
      type: 'directions_car',
      defaultVehicle: isDefault ? 1 : 0
    };

    try {
      const res = await authFetch('/api/vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newVehicle)
      });
      if (res.ok) {
        setMake(''); setModel(''); setColor(''); setPlate(''); setIsDefault(false);
        fetchVehicles();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this vehicle?')) return;
    try {
      const res = await fetch(`/api/vehicles/${id}`, { method: 'DELETE' });
      if (res.ok) fetchVehicles();
    } catch (err) {
      console.error(err);
    }
  };

  const handleVerify = async (id) => {
    try {
      const res = await fetch(`/api/vehicles/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'VERIFIED' })
      });
      if (res.ok) fetchVehicles();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <>
      <header className="mb-lg">
        <h2 className="font-headline-lg text-headline-lg text-on-background">{config.title}</h2>
        <p className="text-on-surface-variant font-body-md">{config.subtitle}</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-lg">
        
        {/* Vehicle Table */}
        <section className={`${config.canRegister ? 'lg:col-span-8' : 'lg:col-span-12'} flex flex-col gap-lg`}>
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm overflow-hidden">
            <div className="px-lg py-md border-b border-outline-variant flex justify-between items-center">
              <h3 className="font-headline-md text-headline-md">Registered Vehicles</h3>
              <span className="bg-secondary-container text-on-secondary-container px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider">
                {vehicles.length} Total
              </span>
            </div>
            
            <div className="overflow-x-auto min-h-[200px]">
              {loading ? (
                <div className="flex justify-center py-10"><span className="material-symbols-outlined animate-spin text-3xl text-primary">refresh</span></div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead className="bg-surface-container-low border-b border-outline-variant">
                    <tr>
                      <th className="px-lg py-3 font-label-md text-label-md text-on-surface-variant">Vehicle Details</th>
                      <th className="px-lg py-3 font-label-md text-label-md text-on-surface-variant">Plate #</th>
                      <th className="px-lg py-3 font-label-md text-label-md text-on-surface-variant">Status</th>
                      {role !== 'employee' && (
                        <th className="px-lg py-3 font-label-md text-label-md text-on-surface-variant">Default</th>
                      )}
                      <th className="px-lg py-3 font-label-md text-label-md text-on-surface-variant">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant">
                    {vehicles.map(v => (
                      <tr key={v.id} className="hover:bg-surface-container transition-colors group">
                        <td className="px-lg py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded bg-surface-container-highest flex items-center justify-center text-primary">
                              <span className="material-symbols-outlined text-3xl">{v.type || 'directions_car'}</span>
                            </div>
                            <div>
                              <p className="font-bold text-on-surface">{v.make} {v.model}</p>
                              <p className="text-xs text-on-surface-variant">{v.color}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-lg py-4 font-mono text-sm font-bold tracking-tight">{v.plate}</td>
                        <td className="px-lg py-4">
                          {v.status === 'VERIFIED' ? (
                            <span className="bg-secondary-container/50 text-secondary border border-secondary/20 px-2.5 py-0.5 rounded text-[11px] font-bold">VERIFIED</span>
                          ) : (
                            <span className="bg-tertiary-fixed text-on-tertiary-fixed-variant border border-tertiary-fixed-dim px-2.5 py-0.5 rounded text-[11px] font-bold">PENDING</span>
                          )}
                        </td>
                        {role !== 'employee' && (
                          <td className="px-lg py-4">
                            {v.defaultVehicle ? (
                              <div className="w-10 h-6 bg-primary rounded-full flex items-center px-1">
                                <div className="w-4 h-4 bg-white rounded-full translate-x-4 shadow-sm"></div>
                              </div>
                            ) : (
                              <div className="w-10 h-6 bg-surface-variant rounded-full flex items-center px-1">
                                <div className="w-4 h-4 bg-white rounded-full translate-x-0 shadow-sm"></div>
                              </div>
                            )}
                          </td>
                        )}
                        <td className="px-lg py-4">
                          <div className="flex items-center gap-sm">
                            {config.canVerify && v.status === 'PENDING' && (
                              <button onClick={() => handleVerify(v.id)} className="text-secondary hover:bg-secondary/10 p-1 rounded transition-colors cursor-pointer" title="Verify">
                                <span className="material-symbols-outlined text-lg">verified</span>
                              </button>
                            )}
                            {config.canDelete && (
                              <button onClick={() => handleDelete(v.id)} className="text-error hover:bg-error/10 p-1 rounded transition-colors cursor-pointer" title="Delete">
                                <span className="material-symbols-outlined text-lg">delete</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {vehicles.length === 0 && (
                      <tr>
                        <td colSpan="5" className="px-lg py-8 text-center text-on-surface-variant">No vehicles registered yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
          
          {/* Session History */}
          {config.showHistory && (
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm overflow-hidden">
              <div className="px-lg py-md border-b border-outline-variant">
                <h3 className="font-headline-md text-headline-md">Session History</h3>
              </div>
              <div className="divide-y divide-outline-variant">
                <div className="px-lg py-4 flex items-center justify-between hover:bg-surface-container transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-secondary-container/30 flex items-center justify-center text-secondary">
                      <span className="material-symbols-outlined">local_parking</span>
                    </div>
                    <div>
                      <p className="font-bold text-on-surface">West Plaza - Spot B12</p>
                      <p className="text-xs text-on-surface-variant">Tesla Model 3 • Oct 24, 09:15 AM - 05:30 PM</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-on-surface">$12.50</p>
                    <p className="text-[10px] text-secondary font-bold uppercase">Paid</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Register Form — only for roles that can register */}
        {config.canRegister && (
          <aside className="lg:col-span-4 flex flex-col gap-lg">
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm p-lg sticky top-xl">
              <div className="mb-lg">
                <h3 className="font-headline-md text-headline-md mb-xs">
                  {role === 'employee' ? 'Add My Vehicle' : 'Register Vehicle'}
                </h3>
                <p className="text-on-surface-variant text-sm">
                  {role === 'employee' ? 'Add your car for automated gate access.' : 'Add a new vehicle to the system registry.'}
                </p>
              </div>
              
              <form onSubmit={handleRegister} className="space-y-md">
                <div>
                  <label className="block font-label-md text-label-md text-on-surface-variant mb-1">Plate Number</label>
                  <input 
                    value={plate} onChange={e => setPlate(e.target.value)}
                    className="w-full bg-surface border border-outline-variant rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all font-mono uppercase" 
                    placeholder="e.g. ABC-1234" type="text" required
                  />
                </div>
                <div className="grid grid-cols-2 gap-md">
                  <div>
                    <label className="block font-label-md text-label-md text-on-surface-variant mb-1">Make</label>
                    <input 
                      value={make} onChange={e => setMake(e.target.value)}
                      className="w-full bg-surface border border-outline-variant rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-primary outline-none" 
                      placeholder="Tesla" type="text" required
                    />
                  </div>
                  <div>
                    <label className="block font-label-md text-label-md text-on-surface-variant mb-1">Model</label>
                    <input 
                      value={model} onChange={e => setModel(e.target.value)}
                      className="w-full bg-surface border border-outline-variant rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-primary outline-none" 
                      placeholder="Model Y" type="text" required
                    />
                  </div>
                </div>
                <div>
                  <label className="block font-label-md text-label-md text-on-surface-variant mb-1">Color</label>
                  <select 
                    value={color} onChange={e => setColor(e.target.value)}
                    className="w-full bg-surface border border-outline-variant rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-primary outline-none"
                  >
                    <option>Select Color</option>
                    <option>Silver</option>
                    <option>White</option>
                    <option>Black</option>
                    <option>Blue</option>
                    <option>Red</option>
                  </select>
                </div>
                
                <div className="flex items-center justify-between py-2">
                  <span className="font-label-md text-label-md text-on-surface">Set as Default</span>
                  <button 
                    onClick={() => setIsDefault(!isDefault)}
                    className={`w-12 h-6 rounded-full relative transition-colors duration-200 cursor-pointer ${isDefault ? 'bg-primary' : 'bg-surface-variant'}`} 
                    type="button"
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform duration-200 shadow-sm ${isDefault ? 'left-1 translate-x-6' : 'left-1'}`}></div>
                  </button>
                </div>
                
                <button 
                  type="submit"
                  className="w-full bg-primary text-on-primary py-3 rounded-lg font-bold hover:bg-on-primary-fixed-variant transition-colors shadow-md active:scale-[0.98] cursor-pointer"
                >
                  {role === 'employee' ? 'Add Vehicle' : 'Register Vehicle'}
                </button>
              </form>
            </div>
            
            <div className="bg-primary-container text-on-primary-container rounded-xl p-lg relative overflow-hidden group">
              <div className="relative z-10">
                <h4 className="font-bold mb-1">
                  {role === 'employee' ? 'Verification Info' : 'Need help with documents?'}
                </h4>
                <p className="text-xs opacity-90 leading-relaxed">
                  {role === 'employee' 
                    ? 'Your vehicle will be verified within 24 hours. Once verified, you get automated gate access and priority slot booking.'
                    : 'Our verification team reviews all registration documents within 24 hours. Verified vehicles get access to priority slots.'}
                </p>
              </div>
              <span className="material-symbols-outlined absolute -right-4 -bottom-4 text-8xl opacity-10 group-hover:rotate-12 transition-transform duration-700">help_center</span>
            </div>
          </aside>
        )}
      </div>
    </>
  );
}





