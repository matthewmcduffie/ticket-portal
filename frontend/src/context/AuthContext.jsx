import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import api from '../services/api.js';

const AuthContext = createContext(null);

const WARN_MS   = 8 * 60 * 1000;
const LOGOUT_MS = 10 * 60 * 1000;

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState(false);

  const warnTimer   = useRef(null);
  const logoutTimer = useRef(null);
  const warningUp   = useRef(false);

  // ── Initial session check via httpOnly cookie ────────────
  useEffect(() => {
    api.get('/auth/me')
      .then(res => setUser(res.data))
      .catch(() => {}) // no cookie = 401 = user stays null
      .finally(() => setLoading(false));
  }, []);

  // ── Timer helpers ────────────────────────────────────────
  function clearTimers() {
    clearTimeout(warnTimer.current);
    clearTimeout(logoutTimer.current);
  }

  function startTimers() {
    clearTimers();
    warnTimer.current = setTimeout(() => {
      setWarning(true);
      warningUp.current = true;
    }, WARN_MS);
    logoutTimer.current = setTimeout(doLogout, LOGOUT_MS);
  }

  // ── Auth actions ─────────────────────────────────────────
  function doLogout() {
    clearTimers();
    api.post('/auth/logout').catch(() => {}); // ask server to clear the cookie
    setUser(null);
    setWarning(false);
    warningUp.current = false;
  }

  function login(userData) {
    // Cookie is already set by the server; just update React state
    setUser(userData);
  }

  function extendSession() {
    setWarning(false);
    warningUp.current = false;
    startTimers();
  }

  // ── Inactivity tracking ──────────────────────────────────
  useEffect(() => {
    if (!user) { clearTimers(); return; }

    const EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

    function onActivity() {
      if (!warningUp.current) startTimers();
    }

    EVENTS.forEach(e => window.addEventListener(e, onActivity, { passive: true }));
    startTimers();

    return () => {
      EVENTS.forEach(e => window.removeEventListener(e, onActivity));
      clearTimers();
    };
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout: doLogout, warning, extendSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
