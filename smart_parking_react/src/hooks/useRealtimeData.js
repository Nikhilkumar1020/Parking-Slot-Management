import { useState, useEffect, useCallback, useRef } from 'react';
import { useSocket } from '../context/SocketContext';
import { authFetch } from '../context/AuthContext';

/**
 * Custom hook for real-time data fetching.
 *
 * Fetches data on mount and auto-refetches when Socket.IO events fire.
 *
 * Issue #2 & #9 — Polling fallback:
 *   When Socket.IO is disconnected, activates a REST polling interval
 *   (default 30s) so data stays reasonably fresh even without WebSocket.
 *   Polling is cancelled as soon as the socket reconnects.
 *
 * @param {string} url - API endpoint to fetch from
 * @param {string|string[]} events - Socket.IO event(s) to listen for
 * @param {object} options
 * @param {Function} [options.transform]     - Transform the response before storing
 * @param {*}        [options.defaultValue]  - Initial value before first fetch
 * @param {number}   [options.pollInterval]  - Polling interval in ms when offline (default 30000)
 * @param {boolean}  [options.paginated]     - If true, expects { data, total, page } shape
 */
export function useRealtimeData(url, events, options = {}) {
  const { transform, defaultValue = [], pollInterval = 30_000, paginated = false } = options;
  const { socket, connected } = useSocket();

  const [data, setData] = useState(defaultValue);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const pollTimerRef = useRef(null);

  const fetchData = useCallback(async () => {
    try {
      // Use authFetch so the Authorization header is always included
      const res = await authFetch(url);
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          // Auth errors are handled by the auth middleware / SocketContext force:relogin
          throw new Error(`Auth error (${res.status})`);
        }
        throw new Error(`Failed to fetch ${url} (${res.status})`);
      }
      let result = await res.json();
      // Handle paginated responses (Issue #10)
      if (paginated && result.data !== undefined) result = result.data;
      if (transform) result = transform(result);
      setData(result);
      setError(null);
    } catch (err) {
      setError(err.message);
      console.error(`[useRealtimeData] Fetch error for ${url}:`, err.message);
    } finally {
      setLoading(false);
    }
  }, [url, paginated]); // eslint-disable-line react-hooks/exhaustive-deps

  // Initial fetch on mount
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Subscribe to socket events for instant updates when online
  useEffect(() => {
    if (!socket) return;
    const eventList = Array.isArray(events) ? events : [events];
    const handler = () => {
      console.log(`[Realtime] Socket event → refetching ${url}`);
      fetchData();
    };
    eventList.forEach(event => socket.on(event, handler));
    return () => {
      eventList.forEach(event => socket.off(event, handler));
    };
  }, [socket, events, fetchData, url]);

  // Issue #2 & #9 — Polling fallback when Socket.IO is disconnected.
  // Starts a REST poll at pollInterval ms. Cleared when socket reconnects.
  useEffect(() => {
    if (!connected) {
      console.log(`[Realtime] Socket offline — starting ${pollInterval}ms poll for ${url}`);
      pollTimerRef.current = setInterval(() => {
        console.log(`[Realtime] Poll tick → refetching ${url}`);
        fetchData();
      }, pollInterval);
    } else {
      // Socket reconnected — clear poll, do an immediate re-fetch to catch up
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
        console.log(`[Realtime] Socket reconnected — stopped polling for ${url}`);
        fetchData(); // one immediate sync fetch on reconnect
      }
    }

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [connected, pollInterval, url, fetchData]);

  return { data, loading, error, refetch: fetchData };
}
