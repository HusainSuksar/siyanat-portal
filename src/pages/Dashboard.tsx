import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import StandardUserDashboard from './StandardUserDashboard';
import AdminDashboard from './dashboards/AdminDashboard';
import SupervisorDashboard from './dashboards/SupervisorDashboard';
import SiyanatDashboard from './dashboards/SiyanatDashboard';
import TanzeemDashboard from './dashboards/TanzeemDashboard';
import TechnicianPortal from './TechnicianPortal';

export default function Dashboard() {
  const { role } = useAuth();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (role) setLoading(false);
  }, [role]);

  if (loading) return <div className="p-12 text-center text-slate-500 animate-pulse font-bold">Loading Workspace...</div>;

  // The Master Switchboard Logic
  switch (role) {
    case 'SUPER_ADMIN':
    case 'ADMIN':
      return <AdminDashboard />;
      
    case 'SIYANAT_HEAD':
    case 'AVIT_HEAD':
      return <SiyanatDashboard />;
      
    case 'TANZEEM_HEAD':
      return <TanzeemDashboard />;
      
    case 'SUPERVISOR':
      return <SupervisorDashboard />;
      
    // THE FIX: Maps the new EXECUTOR role to the correct portal
    case 'EXECUTOR':
    case 'TECHNICIAN':
      return <TechnicianPortal />;
      
    case 'REQUESTER':
    case 'STANDARD_USER':
    default:
      return <StandardUserDashboard />;
  }
}