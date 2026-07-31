import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { ToastProvider } from './context/ToastContext';
import Layout from './components/Layout';
import AIControlCenter from './pages/AIControlCenter';
import AdminDashboard from './pages/AdminDashboard';
import AuthenticationLogin from './pages/AuthenticationLogin';
import EmployeeDashboard from './pages/EmployeeDashboard';
import LandingDashboard from './pages/LandingDashboard';
import LiveParkingMap from './pages/LiveParkingMap';
import NotificationsCenter from './pages/NotificationsCenter';
import ReportsAnalytics from './pages/ReportsAnalytics';
import ReservationModule from './pages/ReservationModule';
import SlotManagement from './pages/SlotManagement';
import UserProfile from './pages/UserProfile';
import VehicleManagement from './pages/VehicleManagement';
import VisitorManagement from './pages/VisitorManagement';
import UserManagement from './pages/UserManagement';

// Define route permissions
const rolePermissions = {
  superadmin: ['/admin-dashboard', '/slot-management', '/vehicle-management', '/visitor-management', '/reservation-module', '/live-parking-map', '/reports-analytics', '/user-profile', '/notifications-center', '/employee-dashboard', '/landing-dashboard', '/user-management', '/ai-control'],
  facility_manager: ['/admin-dashboard', '/reports-analytics', '/vehicle-management', '/visitor-management', '/user-profile', '/notifications-center', '/ai-control'],
  parking_administrator: ['/slot-management', '/reservation-module', '/vehicle-management', '/live-parking-map', '/user-profile', '/notifications-center', '/ai-control'],
  security_officer: ['/visitor-management', '/live-parking-map', '/notifications-center', '/user-profile'],
  employee: ['/employee-dashboard', '/vehicle-management', '/reservation-module', '/user-profile', '/notifications-center'],
  visitor: ['/landing-dashboard', '/reservation-module', '/user-profile', '/notifications-center'],
};

const ProtectedRoute = () => {
  const { user } = useAuth();
  const location = useLocation();
  
  if (!user) {
    return <Navigate to="/authentication-login" replace />;
  }

  const userAllowedPaths = rolePermissions[user.role] || [];
  const currentPath = location.pathname;

  if (currentPath === '/' || currentPath === '') {
    return <Navigate to={userAllowedPaths[0] || '/authentication-login'} replace />;
  }

  if (!userAllowedPaths.includes(currentPath)) {
    return <Navigate to={userAllowedPaths[0] || '/authentication-login'} replace />;
  }

  return <Outlet />;
};

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <SocketProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/authentication-login" replace />} />
            <Route path="/authentication-login" element={<AuthenticationLogin />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route path="/admin-dashboard" element={<AdminDashboard />} />
                <Route path="/ai-control" element={<AIControlCenter />} />
                <Route path="/employee-dashboard" element={<EmployeeDashboard />} />
                <Route path="/landing-dashboard" element={<LandingDashboard />} />
                <Route path="/live-parking-map" element={<LiveParkingMap />} />
                <Route path="/notifications-center" element={<NotificationsCenter />} />
                <Route path="/reports-analytics" element={<ReportsAnalytics />} />
                <Route path="/reservation-module" element={<ReservationModule />} />
                <Route path="/slot-management" element={<SlotManagement />} />
                <Route path="/user-profile" element={<UserProfile />} />
                <Route path="/vehicle-management" element={<VehicleManagement />} />
                <Route path="/visitor-management" element={<VisitorManagement />} />
                <Route path="/user-management" element={<UserManagement />} />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
        </SocketProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
