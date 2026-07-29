import React, { useState, useRef, useEffect, useCallback } from 'react';
import { NavLink, Outlet, useNavigate, Link } from 'react-router-dom';
import { useAuth, authFetch } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useToast } from '../context/ToastContext';
import OfflineBanner from './OfflineBanner';

const ALL_NAV_ITEMS = [
  { path: '/admin-dashboard', icon: 'dashboard', label: 'Admin Dashboard', roles: ['superadmin', 'facility_manager'] },
  { path: '/employee-dashboard', icon: 'badge', label: 'Employee Dashboard', roles: ['superadmin', 'employee'] },
  { path: '/landing-dashboard', icon: 'home', label: 'Visitor Dashboard', roles: ['superadmin', 'visitor'] },
  { path: '/slot-management', icon: 'directions_car_filled', label: 'Slot Management', roles: ['superadmin', 'parking_administrator'] },
  { path: '/vehicle-management', icon: 'directions_car', label: 'Vehicle Registry', roles: ['superadmin', 'facility_manager', 'parking_administrator', 'employee'] },
  { path: '/visitor-management', icon: 'group_add', label: 'Visitor Access', roles: ['superadmin', 'facility_manager', 'security_officer'] },
  { path: '/reservation-module', icon: 'calendar_month', label: 'Reservations', roles: ['superadmin', 'parking_administrator', 'employee', 'visitor'] },
  { path: '/live-parking-map', icon: 'map', label: 'Live Map', roles: ['superadmin', 'parking_administrator', 'security_officer'] },
  { path: '/reports-analytics', icon: 'query_stats', label: 'Analytics', roles: ['superadmin', 'facility_manager'] },
  { path: '/user-management', icon: 'manage_accounts', label: 'User Management', roles: ['superadmin'] },
  { path: '/notifications-center', icon: 'notifications', label: 'Notifications', roles: ['superadmin', 'facility_manager', 'parking_administrator', 'security_officer', 'employee', 'visitor'] },
  { path: '/user-profile', icon: 'settings', label: 'Settings', roles: ['superadmin', 'facility_manager', 'parking_administrator', 'security_officer', 'employee', 'visitor'] },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { connected, clientCount } = useSocket();
  const navigate = useNavigate();
  const toast = useToast();

  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 1024);
  const [darkMode, setDarkMode] = useState(localStorage.getItem('theme') === 'dark');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [notifDropdown, setNotifDropdown] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const searchRef = useRef(null);
  const notifRef = useRef(null);

  const navItems = ALL_NAV_ITEMS.filter(item => item.roles.includes(user?.role));
  const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'User')}&background=0D8BFF&color=fff&size=40`;

  // Fetch notifications for bell
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await authFetch('/api/notifications');
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.slice(0, 5));
    } catch (_) {}
  }, []);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  // Search with debounce
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults(null); return; }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await authFetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
        if (!res.ok) return;
        const data = await res.json();
        setSearchResults(data);
      } catch (_) {} finally {
        setSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Click outside to close dropdowns
  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) setSearchResults(null);
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifDropdown(false);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  // Dark mode effect
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  const handleLogout = () => {
    logout();
    navigate('/authentication-login');
  };

  const totalResults = searchResults ? (searchResults.vehicles?.length || 0) + (searchResults.users?.length || 0) + (searchResults.visitors?.length || 0) : 0;
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="bg-background text-on-surface min-h-screen">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Top Navigation Bar */}
      <header className="bg-surface sticky top-0 w-full border-b border-outline-variant shadow-sm flex items-center justify-between px-lg h-16 z-50">
        <div className="flex items-center gap-md">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="material-symbols-outlined text-on-surface hover:bg-surface-container-highest p-sm rounded-lg transition-colors cursor-pointer"
          >
            menu
          </button>
          <h1 className="font-headline-lg text-headline-lg font-bold text-primary">ParkSystem</h1>
          {user && (
            <span className="ml-sm px-sm py-xs bg-primary-container text-on-primary-container rounded-lg font-label-md uppercase tracking-wider text-[10px] hidden sm:block">
              {user.role.replace(/_/g, ' ')}
            </span>
          )}
        </div>

        <div className="flex items-center gap-md">
          {/* Search Bar */}
          <div className="relative hidden md:block" ref={searchRef}>
            <div className="flex items-center bg-surface-container-low rounded-lg px-md py-xs border border-outline-variant focus-within:border-primary transition-colors">
              <span className="material-symbols-outlined text-on-surface-variant text-body-md mr-sm">search</span>
              <input
                className="bg-transparent border-none focus:ring-0 text-body-md w-56 p-0 outline-none"
                placeholder="Search vehicles, users..."
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              {searchLoading && <span className="material-symbols-outlined text-[16px] text-outline animate-spin ml-sm">refresh</span>}
            </div>
            {/* Search Dropdown */}
            {searchQuery && (
              <div className="absolute top-full mt-sm left-0 right-0 bg-surface rounded-xl shadow-xl border border-outline-variant z-50 overflow-hidden max-h-80 overflow-y-auto">
                {totalResults === 0 && !searchLoading ? (
                  <div className="p-md text-center text-on-surface-variant font-body-md">No results for "{searchQuery}"</div>
                ) : (
                  <>
                    {searchResults?.vehicles?.length > 0 && (
                      <div>
                        <p className="px-md pt-md pb-xs font-label-md text-on-surface-variant uppercase tracking-wider text-[10px]">Vehicles</p>
                        {searchResults.vehicles.map(v => (
                          <button key={v.id} onClick={() => { navigate('/vehicle-management'); setSearchQuery(''); setSearchResults(null); }} className="w-full flex items-center gap-md px-md py-sm hover:bg-surface-container-low transition-colors cursor-pointer text-left">
                            <span className="material-symbols-outlined text-[18px] text-on-surface-variant">directions_car</span>
                            <div>
                              <p className="font-bold text-body-md">{v.plate}</p>
                              <p className="text-[11px] text-on-surface-variant">{v.make} {v.model} · {v.status}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    {searchResults?.users?.length > 0 && (
                      <div>
                        <p className="px-md pt-md pb-xs font-label-md text-on-surface-variant uppercase tracking-wider text-[10px]">Users</p>
                        {searchResults.users.map(u => (
                          <button key={u.id} onClick={() => { navigate('/user-management'); setSearchQuery(''); setSearchResults(null); }} className="w-full flex items-center gap-md px-md py-sm hover:bg-surface-container-low transition-colors cursor-pointer text-left">
                            <span className="material-symbols-outlined text-[18px] text-on-surface-variant">person</span>
                            <div>
                              <p className="font-bold text-body-md">{u.name}</p>
                              <p className="text-[11px] text-on-surface-variant">{u.email} · {u.role}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    {searchResults?.visitors?.length > 0 && (
                      <div>
                        <p className="px-md pt-md pb-xs font-label-md text-on-surface-variant uppercase tracking-wider text-[10px]">Visitors</p>
                        {searchResults.visitors.map(v => (
                          <button key={v.id} onClick={() => { navigate('/visitor-management'); setSearchQuery(''); setSearchResults(null); }} className="w-full flex items-center gap-md px-md py-sm hover:bg-surface-container-low transition-colors cursor-pointer text-left">
                            <span className="material-symbols-outlined text-[18px] text-on-surface-variant">person_pin</span>
                            <div>
                              <p className="font-bold text-body-md">{v.name}</p>
                              <p className="text-[11px] text-on-surface-variant">Host: {v.host} · {v.status}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Theme Toggle */}
          <button
            onClick={(e) => { e.stopPropagation(); setDarkMode(!darkMode); }}
            className="p-sm rounded-full hover:bg-surface-container-low transition-colors cursor-pointer mr-2"
          >
            <span className="material-symbols-outlined text-on-surface-variant text-[22px]">
              {darkMode ? 'light_mode' : 'dark_mode'}
            </span>
          </button>

          {/* Notification Bell */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={(e) => { e.stopPropagation(); setNotifDropdown(!notifDropdown); fetchNotifications(); }}
              className="relative p-sm rounded-full hover:bg-surface-container-low transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-on-surface-variant text-[22px]">notifications</span>
              {unreadCount > 0 && (
                <span className="absolute top-0 right-0 w-4 h-4 bg-error text-on-error rounded-full text-[9px] font-bold flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            {notifDropdown && (
              <div className="absolute right-0 top-full mt-sm w-80 bg-surface rounded-xl shadow-xl border border-outline-variant z-50 overflow-hidden">
                <div className="flex items-center justify-between px-md py-sm border-b border-outline-variant bg-surface-container-low">
                  <p className="font-bold text-body-md">Notifications</p>
                  <Link to="/notifications-center" onClick={() => setNotifDropdown(false)} className="text-primary text-[12px] font-bold hover:underline cursor-pointer">View All</Link>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-md text-center text-on-surface-variant">No notifications</div>
                  ) : notifications.map(n => (
                    <div key={n.id} className={`px-md py-sm border-b border-outline-variant/50 hover:bg-surface-container-low transition-colors ${!n.read ? 'bg-primary-container/10' : ''}`}>
                      <p className="font-bold text-body-md text-on-surface">{n.title}</p>
                      <p className="text-[12px] text-on-surface-variant line-clamp-1">{n.message}</p>
                      <p className="text-[10px] text-outline mt-xs">{n.time}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Profile Dropdown */}
          <div className="group relative">
            <div className="h-9 w-9 rounded-full overflow-hidden border-2 border-primary cursor-pointer">
              <img alt="Profile" src={avatarUrl} />
            </div>
            <div className="absolute right-0 top-full mt-2 w-52 bg-surface rounded-xl shadow-lg border border-outline-variant opacity-0 scale-95 pointer-events-none group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto transition-all z-50 overflow-hidden">
              <div className="p-md border-b border-outline-variant bg-surface-container-low">
                <p className="font-bold text-body-md">{user?.name || 'User'}</p>
                <p className="text-[12px] text-on-surface-variant capitalize">{user?.role?.replace(/_/g, ' ')}</p>
              </div>
              <Link to="/user-profile" className="w-full text-left px-md py-sm font-label-md text-on-surface hover:bg-surface-container transition-colors flex items-center gap-sm cursor-pointer">
                <span className="material-symbols-outlined text-[18px]">settings</span>
                Profile Settings
              </Link>
              <button onClick={handleLogout} className="w-full text-left px-md py-sm font-label-md text-error hover:bg-error-container hover:text-on-error-container transition-colors flex items-center gap-sm cursor-pointer">
                <span className="material-symbols-outlined text-[18px]">logout</span>
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-64px)] overflow-hidden relative">
        {/* Sidebar Navigation — works on both mobile and desktop */}
        <aside className={`fixed left-0 top-16 h-[calc(100vh-64px)] w-[280px] border-r-2 border-outline-variant bg-surface-container shadow-2xl py-md flex flex-col z-40 overflow-y-auto custom-scrollbar transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <nav className="flex-1 space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `mx-2 flex items-center px-md py-sm gap-md cursor-pointer rounded-lg transition-colors ${
                    isActive
                      ? 'bg-primary-container text-on-primary-container'
                      : 'text-on-surface-variant hover:bg-surface-container-high'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span className="material-symbols-outlined" style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}>
                      {item.icon}
                    </span>
                    <span className="font-label-md text-label-md">{item.label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          {/* Bottom Panel — Realtime Status */}
          <div className="px-lg py-md mt-auto">
            <div className="p-md rounded-xl bg-surface-container flex items-center gap-sm">
              <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${connected ? 'bg-secondary animate-pulse' : 'bg-error'}`} />
              <div className="min-w-0">
                <p className={`font-label-md text-[12px] font-bold ${connected ? 'text-secondary' : 'text-error'}`}>
                  {connected ? 'Live Connected' : 'Reconnecting...'}
                </p>
                {connected && <p className="text-[10px] text-on-surface-variant">{clientCount} active session{clientCount !== 1 ? 's' : ''}</p>}
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className={`flex-1 transition-all duration-300 ${sidebarOpen ? 'lg:ml-[280px]' : 'ml-0'} overflow-y-auto custom-scrollbar p-lg bg-background w-full`}>
          <Outlet />
        </main>

        {/* Issue #2 & #9 — Offline fallback banner */}
        <OfflineBanner />
      </div>
    </div>
  );
}
