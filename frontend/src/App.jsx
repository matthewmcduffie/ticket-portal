import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import ProtectedRoute from './components/ProtectedRoute/ProtectedRoute.jsx';
import Layout from './components/Layout/Layout.jsx';
import Login from './pages/Login/Login.jsx';
import Dashboard from './pages/Dashboard/Dashboard.jsx';
import Tickets from './pages/Tickets/Tickets.jsx';
import Bugs from './pages/Bugs/Bugs.jsx';
import Settings from './pages/Settings/Settings.jsx';
import UsersPage from './pages/Settings/UsersPage.jsx';
import Analytics from './pages/Analytics/Analytics.jsx';
import ChangePassword from './pages/ChangePassword/ChangePassword.jsx';
import ResetPassword from './pages/ResetPassword/ResetPassword.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route element={<ProtectedRoute />}>
            {/* Change-password shown without sidebar/header */}
            <Route path="/change-password" element={<ChangePassword />} />
            <Route element={<Layout />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/tickets" element={<Tickets />} />
              <Route path="/bugs" element={<Bugs />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/settings/users" element={<UsersPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
