import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, authFetch } from '../context/AuthContext';

const ROLE_ROUTES = {
  superadmin: '/admin-dashboard',
  facility_manager: '/admin-dashboard',
  parking_administrator: '/slot-management',
  security_officer: '/live-parking-map',
  employee: '/employee-dashboard',
  visitor: '/landing-dashboard'
};

const DEMO_ACCOUNTS = [
  { id: 'superadmin', name: 'Super Admin', email: 'superadmin@parksystem.com', password: 'superadmin' },
  { id: 'facility_manager', name: 'Facility Manager', email: 'manager@parksystem.com', password: 'manager123' },
  { id: 'parking_administrator', name: 'Parking Admin', email: 'parking@parksystem.com', password: 'parking123' },
  { id: 'security_officer', name: 'Security Officer', email: 'security@parksystem.com', password: 'security123' },
  { id: 'employee', name: 'Employee', email: 'employee@parksystem.com', password: 'employee123' },
  { id: 'visitor', name: 'Visitor', email: 'visitor@parksystem.com', password: 'visitor123' }
];

export default function AuthenticationLogin() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [facility, setFacility] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const [showDemoLogin, setShowDemoLogin] = useState(false);
  const [sessionEndReason, setSessionEndReason] = useState('');

  // Issue #4 & #5 — Display reason when admin force-logged this user out
  useEffect(() => {
    const reason = sessionStorage.getItem('sessionEndReason');
    if (reason) {
      setSessionEndReason(reason);
      sessionStorage.removeItem('sessionEndReason');
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const user = await login(email, password);
      const route = ROLE_ROUTES[user.role] || '/landing-dashboard';
      navigate(route);
    } catch (err) {
      setError(err.message || 'Invalid credentials');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    if (!name || !email || !password || !facility) {
      setError('Please fill in all fields to register your facility.');
      return;
    }
    setIsLoading(true);

    try {
      const user = await register({ name, email, password, facility });
      navigate(ROLE_ROUTES[user.role] || '/admin-dashboard');
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = async (account) => {
    setError('');
    setIsLoading(true);
    try {
      const user = await login(account.email, account.password);
      const route = ROLE_ROUTES[user.role] || '/landing-dashboard';
      navigate(route);
    } catch (err) {
      setError(err.message || 'Demo login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-lg" style={{ background: 'linear-gradient(135deg, var(--md-sys-color-primary-container) 0%, var(--md-sys-color-surface) 50%, var(--md-sys-color-tertiary-container) 100%)' }}>
      <div className="w-full max-w-[448px] flex flex-col gap-lg">
        
        {/* Logo Header */}
        <div className="text-center space-y-xs">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary text-on-primary shadow-lg mb-sm">
            <span className="material-symbols-outlined text-[40px]">local_parking</span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-primary tracking-tight font-extrabold">ParkSystem</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">Enterprise Resource Management</p>
          <div className="flex items-center justify-center gap-xs mt-xs">
            <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-secondary">Real-Time Connected</span>
          </div>
        </div>
        
        {/* Issue #4 & #5 — Session terminated by admin */}
        {sessionEndReason && (
          <div className="flex items-start gap-sm bg-tertiary-container/60 border border-tertiary/30 text-on-tertiary-container p-sm rounded-lg font-label-md">
            <span className="material-symbols-outlined text-[18px] flex-shrink-0 mt-0.5">admin_panel_settings</span>
            <span>{sessionEndReason}</span>
          </div>
        )}

        {error && (
          <div className="bg-error-container text-on-error-container p-sm rounded-lg text-center font-label-md">
            {error}
          </div>
        )}

        {isRegistering ? (
          /* Registration Form */
          <form className="flex flex-col gap-md" onSubmit={handleRegister}>
            <div className="flex flex-col gap-xs">
              <label className="font-label-md text-label-md text-on-surface-variant ml-xs">FACILITY NAME</label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-md top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors">domain</span>
                <input 
                  className="w-full pl-xl pr-md py-md rounded-lg border border-outline-variant bg-surface focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-body-md outline-none" 
                  placeholder="e.g. Downtown Plaza" 
                  type="text" value={facility} onChange={(e) => setFacility(e.target.value)} required
                />
              </div>
            </div>
            <div className="flex flex-col gap-xs">
              <label className="font-label-md text-label-md text-on-surface-variant ml-xs">SUPER ADMIN NAME</label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-md top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors">person</span>
                <input 
                  className="w-full pl-xl pr-md py-md rounded-lg border border-outline-variant bg-surface focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-body-md outline-none" 
                  placeholder="John Doe" 
                  type="text" value={name} onChange={(e) => setName(e.target.value)} required
                />
              </div>
            </div>
            <div className="flex flex-col gap-xs">
              <label className="font-label-md text-label-md text-on-surface-variant ml-xs">ADMIN EMAIL ADDRESS</label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-md top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors">mail</span>
                <input 
                  className="w-full pl-xl pr-md py-md rounded-lg border border-outline-variant bg-surface focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-body-md outline-none" 
                  placeholder="superadmin@parksystem.com" 
                  type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                />
              </div>
            </div>
            <div className="flex flex-col gap-xs">
              <label className="font-label-md text-label-md text-on-surface-variant ml-xs">SECURE PASSWORD</label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-md top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors">lock</span>
                <input 
                  className="w-full pl-xl pr-md py-md rounded-lg border border-outline-variant bg-surface focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-body-md outline-none" 
                  placeholder="••••••••" 
                  type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                />
              </div>
            </div>
            <button 
              type="submit" disabled={isLoading}
              className="w-full bg-primary text-on-primary py-md rounded-lg font-bold text-body-lg shadow-md hover:bg-on-primary-fixed-variant active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
            >
              {isLoading ? 'Registering...' : 'Register Facility & Create Admin'}
            </button>
            <p className="text-center text-body-md text-on-surface-variant">
              Already registered? <button type="button" onClick={() => { setIsRegistering(false); setError(''); }} className="text-primary font-bold hover:underline cursor-pointer">Sign In</button>
            </p>
          </form>
        ) : (
          /* Login Form */
          <form className="flex flex-col gap-md" onSubmit={handleLogin}>
            <div className="flex flex-col gap-xs">
              <label className="font-label-md text-label-md text-on-surface-variant ml-xs">EMAIL ADDRESS</label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-md top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors">mail</span>
                <input 
                  className="w-full pl-xl pr-md py-md rounded-lg border border-outline-variant bg-surface focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-body-md outline-none" 
                  placeholder="you@parksystem.com" 
                  type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                />
              </div>
            </div>
            <div className="flex flex-col gap-xs">
              <label className="font-label-md text-label-md text-on-surface-variant ml-xs">PASSWORD</label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-md top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors">lock</span>
                <input 
                  className="w-full pl-xl pr-md py-md rounded-lg border border-outline-variant bg-surface focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-body-md outline-none" 
                  placeholder="••••••••" 
                  type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                />
              </div>
            </div>
            <button 
              type="submit" disabled={isLoading}
              className="w-full bg-primary text-on-primary py-md rounded-lg font-bold text-body-lg shadow-md hover:bg-on-primary-fixed-variant active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
            <p className="text-center text-body-md text-on-surface-variant">
              New facility? <button type="button" onClick={() => { setIsRegistering(true); setError(''); }} className="text-primary font-bold hover:underline cursor-pointer">Register Here</button>
            </p>
          </form>
        )}

        {/* Demo Quick Login */}
        <div className="border-t border-outline-variant pt-md">
          <button 
            onClick={() => setShowDemoLogin(!showDemoLogin)}
            className="w-full flex items-center justify-center gap-sm text-on-surface-variant hover:text-primary transition-colors cursor-pointer py-sm"
          >
            <span className="material-symbols-outlined text-[18px]">science</span>
            <span className="font-label-md text-label-md">Quick Demo Login</span>
            <span className="material-symbols-outlined text-[18px]">{showDemoLogin ? 'expand_less' : 'expand_more'}</span>
          </button>
          
          {showDemoLogin && (
            <div className="grid grid-cols-2 gap-sm mt-md">
              {DEMO_ACCOUNTS.map(account => (
                <button
                  key={account.id}
                  onClick={() => handleDemoLogin(account)}
                  disabled={isLoading}
                  className="px-md py-sm bg-surface border border-outline-variant rounded-lg text-left hover:border-primary hover:bg-primary-container/10 transition-all cursor-pointer disabled:opacity-50 group"
                >
                  <p className="font-label-md text-label-md text-on-surface group-hover:text-primary transition-colors">{account.name}</p>
                  <p className="text-[10px] text-on-surface-variant truncate">{account.email}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center space-y-xs">
          <p className="text-[10px] text-on-surface-variant">
            ParkSystem v2.0 — Real-Time Enterprise Parking Management
          </p>
        </div>
      </div>
    </div>
  );
}

