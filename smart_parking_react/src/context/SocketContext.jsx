import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [clientCount, setClientCount] = useState(0);
  const [lastSyncTs, setLastSyncTs] = useState(null);
  const { user, logout } = useAuth();

  useEffect(() => {
    const socketInstance = io('/', {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });

    socketInstance.on('connect', () => {
      console.log('[Socket.IO] Connected:', socketInstance.id);
      setConnected(true);
      // Issue #7 — On every (re)connect, ask server for full state snapshot
      // so clients can reconcile any missed events during downtime.
      socketInstance.emit('request:sync');
    });

    socketInstance.on('disconnect', () => {
      console.log('[Socket.IO] Disconnected');
      setConnected(false);
    });

    socketInstance.on('clients:count', (count) => {
      setClientCount(count);
    });

    // Issue #7 — Server sends a state:sync with current slot statuses after reconnect
    socketInstance.on('state:sync', (payload) => {
      console.log('[Socket.IO] State sync received at', payload.ts);
      setLastSyncTs(payload.ts);
      // Components listening for 'slot:update' or 'reservation:update' will
      // automatically re-fetch via useRealtimeData's event listener.
      // We re-emit local events so all subscribers can re-fetch.
      socketInstance.emit('slot:update', { action: 'sync' });
      socketInstance.emit('reservation:update', { action: 'sync' });
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  // Authenticate socket room after login and after reconnects
  useEffect(() => {
    if (socket && connected && user) {
      socket.emit('authenticate', { userId: user.id, role: user.role });
    }
  }, [socket, connected, user]);

  // Issue #5 — Force re-login when admin deactivates user or changes their role.
  // The server emits force:relogin to the user's personal socket room.
  // Issue #4 — Also fires when account is deactivated.
  useEffect(() => {
    if (!socket) return;

    const handleForceRelogin = ({ reason }) => {
      console.warn('[Socket.IO] force:relogin received:', reason);
      // Small delay so the toast is visible before redirect
      setTimeout(() => {
        logout();
        // Store reason so the login page can display it
        sessionStorage.setItem('sessionEndReason', reason || 'Your session was ended by an administrator.');
      }, 500);
    };

    socket.on('force:relogin', handleForceRelogin);
    return () => {
      socket.off('force:relogin', handleForceRelogin);
    };
  }, [socket, logout]);

  return (
    <SocketContext.Provider value={{ socket, connected, clientCount, lastSyncTs }}>
      {children}
    </SocketContext.Provider>
  );
};
