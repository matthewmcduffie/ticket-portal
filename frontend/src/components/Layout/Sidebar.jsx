import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import api from '../../services/api.js';
import './Sidebar.css';

const NAV_ITEMS = [
  { to: '/dashboard',      label: 'Dashboard', icon: 'dashboard' },
  { to: '/tickets',        label: 'Tickets',   icon: 'confirmation_number' },
  { to: '/analytics',      label: 'Analytics', icon: 'bar_chart',    roles: ['admin', 'technician'] },
  { to: '/settings/users', label: 'Users',     icon: 'group',        roles: ['technician'] },
];

export default function Sidebar({ open, onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isAdmin      = user?.role === 'admin';
  const isTechnician = user?.role === 'technician';
  const isPrivileged = isAdmin || isTechnician;

  const canViewBugs    = isPrivileged || user?.can_view_bug_reports;
  const canUseProjects = isPrivileged || user?.can_use_projects;

  const [projectsEnabled, setProjectsEnabled] = useState(false);
  const [equipmentEnabled, setEquipmentEnabled] = useState(false);
  useEffect(() => {
    if (!canUseProjects && !isPrivileged) return;
    api.get('/settings').then(r => {
      setProjectsEnabled(r.data.find(s => s.key === 'projects_enabled')?.value === 'true');
      setEquipmentEnabled(r.data.find(s => s.key === 'equipment_requests_enabled')?.value === 'true');
    }).catch(() => {});
  }, [canUseProjects, isPrivileged]);
  const showProjects  = canUseProjects && projectsEnabled;
  const showEquipment = isPrivileged && equipmentEnabled;

  const navLink = (item) => (
    <NavLink
      key={item.to}
      to={item.to}
      className={({ isActive }) =>
        `sidebar__nav-item${isActive ? ' sidebar__nav-item--active' : ''}`
      }
      onClick={onClose}
    >
      <span className="material-symbols-outlined sidebar__nav-icon">{item.icon}</span>
      <span>{item.label}</span>
    </NavLink>
  );

  return (
    <aside className={`sidebar${open ? ' sidebar--open' : ''}`}>
      <div className="sidebar__brand">
        <div className="sidebar__brand-icon">
          <span className="material-symbols-outlined">confirmation_number</span>
        </div>
        <div>
          <div className="sidebar__brand-name">Tickets</div>
          <div className="sidebar__brand-sub">Support Portal</div>
        </div>
      </div>

      <div className="sidebar__cta">
        <button className="sidebar__new-ticket" onClick={() => { navigate('/tickets?new=1'); onClose?.(); }}>
          <span className="material-symbols-outlined">add</span>
          New Ticket
        </button>
      </div>

      <nav className="sidebar__nav" aria-label="Main navigation">
        {NAV_ITEMS
          .filter(item => !item.roles || item.roles.includes(user?.role))
          .map(navLink)}
        {canViewBugs && navLink({ to: '/bugs', label: 'Bug Tracker', icon: 'bug_report' })}
        {showProjects && navLink({ to: '/projects', label: 'Projects', icon: 'folder_special' })}
        {showEquipment && navLink({ to: '/equipment', label: 'Equipment', icon: 'devices' })}
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
