import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './Header.css';

const PAGE_TITLES = {
  '/dashboard':       'Dashboard',
  '/tickets':         'Tickets',
  '/projects':        'Projects',
  '/analytics':       'Analytics',
  '/settings':        'Settings',
  '/settings/users':  'User Management',
  '/settings/backups': 'Backup Settings',
  '/settings/restore': 'Restore',
};

const BACK_ROUTES = {
  '/settings/users':   '/settings',
  '/settings/backups': '/settings',
  '/settings/restore': '/settings',
};

const PROJECT_DETAIL_RE = /^\/projects\/[^/]+$/;

const APP_VERSION = 'Beta 0.1.1';
const PROJECT_URL = 'https://github.com/matthewmcduffie/ticket-portal';

export default function Header({ onMenuClick }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isProjectDetail = PROJECT_DETAIL_RE.test(pathname);
  const title  = isProjectDetail ? 'Project' : (PAGE_TITLES[pathname] ?? 'Tickets');
  const backTo = isProjectDetail ? '/projects' : BACK_ROUTES[pathname];

  return (
    <header className="header">
      <div className="header__left">
        <button className="header__menu" onClick={onMenuClick} aria-label="Open menu">
          <span className="material-symbols-outlined">menu</span>
        </button>
        {backTo && (
          <button className="header__back" onClick={() => navigate(backTo)} aria-label="Back">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
        )}
        <h1 className="header__title">{title}</h1>
      </div>
      <div className="header__meta-card" aria-label="Application information">
        <span className="header__version">{APP_VERSION}</span>
        <a className="header__project-link" href={PROJECT_URL} target="_blank" rel="noreferrer">
          matthewmcduffie/ticket-portal
        </a>
        <span className="header__copyright">Copyright 2026 Matthew McDuffie</span>
      </div>
    </header>
  );
}
