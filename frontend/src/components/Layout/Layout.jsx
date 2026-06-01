import React, { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import Header from './Header.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import './Layout.css';

const COUNTDOWN_SECS = 120;

export default function Layout() {
  const { warning, extendSession } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  // Close drawer on route change
  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  return (
    <div className="layout">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}
      <div className="layout__main">
        <Header onMenuClick={() => setSidebarOpen(o => !o)} />
        <main className="layout__content">
          <Outlet />
        </main>
      </div>
      {warning && <InactivityWarning onStay={extendSession} />}
    </div>
  );
}

function InactivityWarning({ onStay }) {
  const [secs, setSecs] = useState(COUNTDOWN_SECS);

  useEffect(() => {
    const id = setInterval(() => setSecs(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  const mins = Math.floor(secs / 60);
  const ss   = String(secs % 60).padStart(2, '0');
  const countdown = mins > 0 ? `${mins}:${ss}` : `${secs}s`;

  return (
    <div className="inactivity-overlay" role="alertdialog" aria-modal="true" aria-labelledby="inactivity-msg">
      <div className="inactivity-dialog">
        <div className="inactivity-dialog__emoji">😊</div>
        <p className="inactivity-dialog__msg" id="inactivity-msg">
          Are you there? You've been quiet a long time. I'll log you out for safety.
        </p>
        <p className="inactivity-dialog__countdown">
          Logging out in <strong>{countdown}</strong>
        </p>
        <button className="btn btn--primary inactivity-dialog__btn" onClick={onStay} autoFocus>
          I'm still here
        </button>
      </div>
    </div>
  );
}
