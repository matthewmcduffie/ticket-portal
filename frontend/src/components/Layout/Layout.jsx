import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import Header from './Header.jsx';
import './Layout.css';

export default function Layout() {
  return (
    <div className="layout">
      <Sidebar />
      <div className="layout__main">
        <Header />
        <main className="layout__content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
