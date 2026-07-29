import React, { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';

/**
 * OfflineBanner — Issues #2 & #9
 *
 * Renders a sticky banner when Socket.IO is disconnected, informing the user
 * that real-time updates are paused but the REST API is still operational.
 * The banner shows a countdown to the next polling fetch.
 *
 * Dismissed automatically when the socket reconnects.
 */
export default function OfflineBanner() {
  const { connected } = useSocket();
  const [visible, setVisible] = useState(false);
  const [countdown, setCountdown] = useState(30);

  // Delay showing the banner slightly to avoid flash on initial load
  useEffect(() => {
    let showTimer;
    if (!connected) {
      showTimer = setTimeout(() => setVisible(true), 2000);
    } else {
      setVisible(false);
      setCountdown(30);
    }
    return () => clearTimeout(showTimer);
  }, [connected]);

  // Countdown ticker for the next poll
  useEffect(() => {
    if (!visible) return;
    setCountdown(30);
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) return 30;
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: '1.25rem',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        background: 'rgba(30, 27, 38, 0.95)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(251, 191, 36, 0.3)',
        borderRadius: '0.75rem',
        padding: '0.75rem 1.25rem',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        maxWidth: '520px',
        width: 'calc(100vw - 2rem)',
        animation: 'slideUpFade 0.3s ease-out',
      }}
    >
      {/* Pulsing warning dot */}
      <span style={{
        width: '0.625rem',
        height: '0.625rem',
        borderRadius: '50%',
        background: '#f59e0b',
        flexShrink: 0,
        animation: 'pulse 1.5s ease-in-out infinite',
      }} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          margin: 0,
          fontSize: '0.8125rem',
          fontWeight: 700,
          color: '#fbbf24',
          letterSpacing: '0.01em',
        }}>
          ⚡ Real-time connection lost
        </p>
        <p style={{
          margin: '0.125rem 0 0',
          fontSize: '0.75rem',
          color: 'rgba(255,255,255,0.6)',
        }}>
          REST API still available — data refreshes in <strong style={{ color: 'rgba(255,255,255,0.85)' }}>{countdown}s</strong>
        </p>
      </div>

      {/* Reconnecting spinner */}
      <span
        style={{
          fontSize: '1rem',
          color: '#f59e0b',
          animation: 'spin 1.2s linear infinite',
          flexShrink: 0,
        }}
        className="material-symbols-outlined"
      >
        sync
      </span>

      <style>{`
        @keyframes slideUpFade {
          from { opacity: 0; transform: translateX(-50%) translateY(12px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(0.85); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
