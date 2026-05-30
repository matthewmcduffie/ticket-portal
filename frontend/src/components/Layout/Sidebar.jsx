import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import './Sidebar.css';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/tickets',   label: 'Tickets' },
  { to: '/settings',  label: 'Settings', adminOnly: true },
];

export default function Sidebar() {
  const { user, logout } = useAuth();

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <span className="sidebar__brand-name">Tickets</span>
      </div>

      <nav className="sidebar__nav" aria-label="Main navigation">
        {NAV_ITEMS
          .filter(item => !item.adminOnly || user?.role === 'admin')
          .map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `sidebar__nav-item${isActive ? ' sidebar__nav-item--active' : ''}`
              }
            >
              {item.label}
            </NavLink>
          ))}
      </nav>

      <div className="sidebar__footer">
        <div className="sidebar__user-info">
          <div className="sidebar__user-name">{user?.name}</div>
          <div className="sidebar__user-role">{user?.role}</div>
        </div>
        <button className="sidebar__logout" onClick={logout}>
          Sign out
        </button>
      </div>
    </aside>
  );
}
