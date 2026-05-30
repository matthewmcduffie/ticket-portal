import React from 'react';
import { useLocation } from 'react-router-dom';
import './Header.css';

const PAGE_TITLES = {
  '/dashboard': 'Dashboard',
  '/tickets':   'Tickets',
  '/settings':  'Settings',
};

export default function Header() {
  const { pathname } = useLocation();
  const title = PAGE_TITLES[pathname] ?? 'Tickets';

  return (
    <header className="header">
      <h1 className="header__title">{title}</h1>
    </header>
  );
}
