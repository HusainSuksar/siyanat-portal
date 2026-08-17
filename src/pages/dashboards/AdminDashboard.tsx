import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Activity, Wrench, Package, Calendar, Clock, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function AdminDashboard() {
  const {  role } = useAuth();
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState({ activeComplaints: 0, pendingLogistics: 0, pendingTanzeem: 0 });
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [maintenanceRouting, setMaintenanceRouting] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAdminData() {
      setLoading(true);
      
      // 1. Fetch Global System KPIs
      const { count: compCount } = await supabase.from('complaints').select('*', { count: 'exact', head: true }).not('status', 'in', '("Closed","Verified","Rejected")');
      const { count: poCount } = await supabase.from('purchase_orders').select('*', { count: 'exact', head: true }).eq('status', 'PO Issued');
      const { count: dispatchCount } = await supabase.from('work_orders').select('*', { count: 'exact', head: true }).eq('dispatch_status', 'Pending');
      const { count: eventCount } = await supabase.from('events').select('*', { count: 'exact', head: true }).in('status', ['Pending', 'Pending Approval', 'Pending Tanzeem Approval']);

      setMetrics({
        activeComplaints: compCount || 0,
        pendingLogistics: (poCount || 0) + (dispatchCount || 0),
        pendingTanzeem: eventCount || 0
      });

      // 2. Fetch Live System Heartbeat (Audit Logs)
      const { data: logs } = await supabase.from('system_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(6);
      if (logs) setRecentLogs(logs);

      // 3. Fetch Active Maintenance Routing Tickets
      const { data: maintenance } = await supabase.from('complaints')
        .select('complaint_id, category, venue, status, created_at')
        .not('status', 'in', '("Closed","Verified","Rejected")')
        .order('created_at', { ascending: false })
        .limit(6);
      if (maintenance) setMaintenanceRouting(maintenance);

      setLoading(false);
    }
    
    fetchAdminData();
  }, []);

  return (
    <div className="space-y-6 pb-24 max-w-6xl mx-auto animate-in fade-in duration-500">
      
      {/* Unified Maroon Welcome Banner */}
      <div className="bg-gradient-to-r from-brand-maroon to-brand-dark rounded-3xl p-6 md:p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-gold opacity-5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl md:text-3xl font-black text-brand-gold tracking-tight">My Dashboard</h2>
            <span className="px-3 py-1 bg-brand-gold/20 text-brand-gold text-[9px] font-black uppercase tracking-widest rounded-lg border border-brand-gold/50 shadow-sm">
              {role?.replace('_', ' ') || 'ADMIN'}
            </span>
          </div>
          <p className="text-sm text-slate-200 mt-2 font-medium">Master System Overview & Health Metrics.</p>
        </div>
      </div>

      {/* Light Mode KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between hover:border-amber-300 transition cursor-pointer" onClick={() => navigate('/siyanat-operations')}>
          <div>
            <span className="text-[10px] font-extrabold uppercase text-amber-600 tracking-wider">Active Campus Issues</span>
            <div className="text-3xl font-black text-amber-600 mt-1">{loading ? '-' : metrics.activeComplaints}</div>
          </div>
          <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center">
            <Wrench className="w-6 h-6 text-amber-500" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between hover:border-indigo-300 transition cursor-pointer" onClick={() => navigate('/rto')}>
          <div>
            <span className="text-[10px] font-extrabold uppercase text-indigo-600 tracking-wider">Logistics Bottlenecks</span>
            <div className="text-3xl font-black text-indigo-600 mt-1">{loading ? '-' : metrics.pendingLogistics}</div>
          </div>
          <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center">
            <Package className="w-6 h-6 text-indigo-500" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between hover:border-emerald-300 transition cursor-pointer" onClick={() => navigate('/tanzeem')}>
          <div>
            <span className="text-[10px] font-extrabold uppercase text-emerald-600 tracking-wider">Pending Tanzeem Ops</span>
            <div className="text-3xl font-black text-emerald-600 mt-1">{loading ? '-' : metrics.pendingTanzeem}</div>
          </div>
          <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center">
            <Calendar className="w-6 h-6 text-emerald-500" />
          </div>
        </div>
      </div>

      {/* Grid Layout for Logs and Maintenance Routing */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        
        {/* Active Maintenance Routing Widget (Now Clickable) */}
        <div 
          className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 hover:border-amber-300 transition cursor-pointer group"
          onClick={() => navigate('/siyanat-operations')}
        >
          <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
             <div className="flex items-center gap-2">
               <Wrench className="w-4 h-4 text-amber-500" />
               <h3 className="font-black text-sm uppercase tracking-wide text-slate-800">Maintenance Routing</h3>
             </div>
             <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-amber-500 transition-colors" />
          </div>
          <div className="space-y-3">
            {loading ? (
              <div className="text-center py-6 text-xs font-bold text-slate-400 animate-pulse">Loading routing queue...</div>
            ) : maintenanceRouting.length === 0 ? (
              <div className="text-center py-8 text-xs font-bold text-slate-400 bg-slate-50 rounded-2xl border border-slate-100 italic">No active maintenance issues.</div>
            ) : (
              maintenanceRouting.map(ticket => (
                <div key={ticket.complaint_id} className="flex flex-col p-3.5 bg-slate-50 rounded-xl border border-slate-100 group-hover:bg-amber-50/50 transition">
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="font-black text-brand-maroon text-sm">{ticket.complaint_id}</h4>
                    <span className="text-[9px] font-black text-amber-700 bg-amber-100 px-2 py-0.5 rounded uppercase tracking-wider">{ticket.status}</span>
                  </div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase">{ticket.category} • {ticket.venue}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Live System Heartbeat (Audit Trail) */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
            <Activity className="w-4 h-4 text-brand-maroon animate-pulse" />
            <h3 className="font-black text-sm uppercase tracking-wide text-slate-800">Live System Heartbeat</h3>
          </div>
          <div className="space-y-3">
            {loading ? (
              <div className="text-center py-6 text-xs font-bold text-slate-400 animate-pulse">Connecting to system logs...</div>
            ) : recentLogs.length === 0 ? (
              <div className="text-center py-8 text-xs font-bold text-slate-400 bg-slate-50 rounded-2xl border border-slate-100 italic">No recent activity.</div>
            ) : (
              recentLogs.map(log => (
                <div key={log.id} className="flex flex-col p-3.5 bg-slate-50 rounded-xl border border-slate-100 hover:border-slate-300 transition gap-2">
                  <h4 className="font-bold text-slate-800 text-xs">{log.description}</h4>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-black text-slate-500 uppercase bg-white px-2 py-0.5 rounded border border-slate-200">{log.action_type.replace(/_/g, ' ')}</span>
                      <span className="text-[10px] font-semibold text-brand-maroon">{log.user_email}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400 shrink-0">
                      <Clock className="w-3 h-3" />
                      {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}