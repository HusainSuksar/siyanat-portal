import { useAuth } from '../contexts/AuthContext';
import StandardUserDashboard from './StandardUserDashboard';
import SupervisorDashboard from './dashboards/SupervisorDashboard';
import SiyanatDashboard from './dashboards/SiyanatDashboard';
import TanzeemDashboard from './dashboards/TanzeemDashboard';
import AdminDashboard from './dashboards/AdminDashboard';

export default function Dashboard() {
  const { role } = useAuth();

  switch (role) {
    case 'SUPERVISOR':
      return <SupervisorDashboard />;
    case 'SIYANAT_HEAD':
      return <SiyanatDashboard />;
    case 'TANZEEM_HEAD':
      return <TanzeemDashboard />;
    case 'SUPER_ADMIN':
    case 'ADMIN':
      return <AdminDashboard />;
    case 'TECHNICIAN':
      return <div className="p-12 mt-10 text-center bg-white rounded-3xl border border-slate-200 shadow-sm font-black text-slate-400 uppercase tracking-widest">Technicians operate strictly from 'My Workload'.</div>;
    default:
      return <StandardUserDashboard />;
  }
}