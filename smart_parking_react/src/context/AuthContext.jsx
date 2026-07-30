import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

// Authenticated fetch wrapper — automatically attaches JWT Bearer token
export const authFetch = (url, options = {}) => {
  const token = localStorage.getItem('parkSystemToken');
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('parkSystemUser');
    const storedToken = localStorage.getItem('parkSystemToken');
    if (storedUser && storedToken) {
      setUser(JSON.parse(storedUser));
      setToken(storedToken);
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    setUser(data.user);
    setToken(data.token);
    localStorage.setItem('parkSystemUser', JSON.stringify(data.user));
    localStorage.setItem('parkSystemToken', data.token);
    return data.user;
  };

  const register = async ({ name, email, password, facility }) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, role: 'superadmin', facility }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed');
    setUser(data.user);
    setToken(data.token);
    localStorage.setItem('parkSystemUser', JSON.stringify(data.user));
    localStorage.setItem('parkSystemToken', data.token);
    return data.user;
  };

  const googleLogin = async (googleToken) => {
    const res = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: googleToken }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Google login failed');
    setUser(data.user);
    setToken(data.token);
    localStorage.setItem('parkSystemUser', JSON.stringify(data.user));
    localStorage.setItem('parkSystemToken', data.token);
    return data.user;
  };

  const updateUser = useCallback((updatedFields) => {
    const updated = { ...user, ...updatedFields };
    setUser(updated);
    localStorage.setItem('parkSystemUser', JSON.stringify(updated));
  }, [user]);

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('parkSystemUser');
    localStorage.removeItem('parkSystemToken');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-md">
          <span className="material-symbols-outlined text-4xl text-primary animate-spin">refresh</span>
          <p className="text-on-surface-variant font-label-md">Loading ParkSystem...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, token, login, register, googleLogin, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};
