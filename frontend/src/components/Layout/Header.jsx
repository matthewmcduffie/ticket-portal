import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './Header.css';

const PAGE_TITLES = {
  '/dashboard':       'Dashboard',
  '/tickets':         'Tickets',
  '/analytics':       'Analytics',
  '/settings':        'Settings',
  '/settings/users':  'User Management',
};

const BACK_ROUTES = {
  '/settings/users': '/settings',
};

export default function Header({ onMenuClick }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const title  = PAGE_TITLES[pathname] ?? 'Tickets';
  const backTo = BACK_ROUTES[pathname];

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
    </header>
  );
}
