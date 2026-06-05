import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import Tickets from '../Tickets/Tickets.jsx';

export default function Bugs() {
  const { user } = useAuth();
  const canViewBugs = user?.role === 'admin' || user?.can_view_bug_reports;

  if (!canViewBugs) return <Navigate to="/dashboard" replace />;

  return <Tickets issueType="bug" />;
}
