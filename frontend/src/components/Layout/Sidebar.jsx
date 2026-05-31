import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import './Sidebar.css';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { to: '/tickets',   label: 'Tickets',   icon: 'confirmation_number' },
  { to: '/analytics', label: 'Analytics', icon: 'bar_chart', adminOnly: true },
];

export default function Sidebar() {
  const { user, logout } = useAuth();

  const navLink = (item) => (
    <NavLink
      key={item.to}
      to={item.to}
      className={({ isActive }) =>
        `sidebar__nav-item${isActive ? ' sidebar__nav-item--active' : ''}`
      }
    >
      <span className="material-symbols-outlined sidebar__nav-icon">{item.icon}</span>
      <span>{item.label}</span>
    </NavLink>
  );

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <div className="sidebar__brand-icon">
          <span className="material-symbols-outlined">confirmation_number</span>
        </div>
        <div>
          <div className="sidebar__brand-name">Tickets</div>
          <div className="sidebar__brand-sub">Support Portal</div>
        </div>
      </div>

      <nav className="sidebar__nav" aria-label="Main navigation">
        {NAV_ITEMS.filter(item => !item.adminOnly || user?.role === 'admin').map(navLink)}
      </nav>

      {user?.role === 'admin' && (
        <div className="sidebar__nav-bottom">
          <hr className="sidebar__divider" />
          {navLink({ to: '/settings', label: 'Settings', icon: 'settings' })}
        </div>
      )}

      <div className="sidebar__footer">
        <div className="sidebar__user">
          <div className="sidebar__user-avatar">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div className="sidebar__user-info">
            <div className="sidebar__user-name">{user?.name}</div>
            <div className="sidebar__user-role">{user?.role}</div>
          </div>
          <button className="sidebar__logout" onClick={logout} title="Sign out">
            <span className="material-symbols-outlined">logout</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
