import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Wrench, CheckCircle, Clock, AlertTriangle, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function SupervisorDashboard() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState({ pending: 0, active: 0, completed: 0 });
  const [recentPending, setRecentPending] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSupervisorData() {
      setLoading(true);
      
      const { data: authData } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from('profiles').select('zone').eq('id', authData.user?.id).single();
      const zoneFilter = profile?.zone || '';

      // Base Queries
      let pendingQ = supabase.from('complaints').select('*', { count: 'exact', head: true }).eq('pipeline_state', 'SUBMITTED');
      let activeQ = supabase.from('complaints').select('*', { count: 'exact', head: true }).eq('pipeline_state', 'PROCESSING');
      let completedQ = supabase.from('complaints').select('*', { count: 'exact', head: true }).eq('pipeline_state', 'ACTION_REQUIRED');
      let recentQ = supabase.from('complaints').select('complaint_id, category, venue, created_at').eq('pipeline_state', 'SUBMITTED').order('created_at', { ascending: true }).limit(5);

      // Apply Multi-Zone Filtering if Supervisor has domains assigned
      if (zoneFilter) {
        const assignedZones = zoneFilter.split(',').map((z: string) => z.trim());
        pendingQ = pendingQ.in('zone', assignedZones);
        activeQ = activeQ.in('zone', assignedZones);
        completedQ = completedQ.in('zone', assignedZones);
        recentQ = recentQ.in('zone', assignedZones);
      }

      const [{ count: pendingCount }, { count: activeCount }, { count: completedCount }, { data: recent }] = await Promise.all([
        pendingQ, activeQ, completedQ, recentQ
      ]);

      setMetrics({ pending: pendingCount || 0, active: activeCount || 0, completed: completedCount || 0 });
      if (recent) setRecentPending(recent);
      setLoading(false);
    }
    fetchSupervisorData();
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
              {role?.replace('_', ' ') || 'SUPERVISOR'}
            </span>
          </div>
          <p className="text-sm text-slate-200 mt-2 font-medium">Supervisor Command Center & Task Routing.</p>
        </div>
      </div>

      {/* Hyperlinked KPI Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div 
          onClick={() => navigate('/supervisor-queue')}
          className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between hover:border-amber-300 transition cursor-pointer group"
          title="Review Submitted Complaints"
        >
          <div>
            <span className="text-[10px] font-extrabold uppercase text-amber-600 tracking-wider">Pending Approvals</span>
            <div className="text-3xl font-black text-amber-600 mt-1">{loading ? '-' : metrics.pending}</div>
          </div>
          <div className="w-12 h-12 bg-amber-50 group-hover:bg-amber-100 rounded-full flex items-center justify-center transition-colors">
            <AlertTriangle className="w-6 h-6 text-amber-500" />
          </div>
        </div>

        <div 
          onClick={() => navigate('/siyanat-operations')}
          className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between hover:border-indigo-300 transition cursor-pointer group"
          title="View Active Technician Routing"
        >
          <div>
            <span className="text-[10px] font-extrabold uppercase text-indigo-600 tracking-wider">Active Tech Tasks</span>
            <div className="text-3xl font-black text-indigo-600 mt-1">{loading ? '-' : metrics.active}</div>
          </div>
          <div className="w-12 h-12 bg-indigo-50 group-hover:bg-indigo-100 rounded-full flex items-center justify-center transition-colors">
            <Wrench className="w-6 h-6 text-indigo-500" />
          </div>
        </div>

        <div 
          onClick={() => navigate('/supervisor-queue')}
          className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between hover:border-emerald-300 transition cursor-pointer group"
          title="Verify Completed Issues"
        >
          <div>
            <span className="text-[10px] font-extrabold uppercase text-emerald-600 tracking-wider">Awaiting Verification</span>
            <div className="text-3xl font-black text-emerald-600 mt-1">{loading ? '-' : metrics.completed}</div>
          </div>
          <div className="w-12 h-12 bg-emerald-50 group-hover:bg-emerald-100 rounded-full flex items-center justify-center transition-colors">
            <CheckCircle className="w-6 h-6 text-emerald-500" />
          </div>
        </div>
      </div>

      {/* Action Required: Oldest Pending Requests */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 mt-6">
        <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-500" />
            <h3 className="font-black text-sm uppercase tracking-wide text-slate-800">Action Required: Oldest Pending Requests</h3>
          </div>
          <button 
            onClick={() => navigate('/supervisor-queue')} 
            className="text-xs font-bold text-brand-maroon hover:text-brand-dark flex items-center gap-1 transition"
          >
            View All <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-6 text-xs font-bold text-slate-400 animate-pulse">Loading queue...</div>
          ) : recentPending.length === 0 ? (
            <div className="text-center py-8 text-xs font-bold text-emerald-600 bg-emerald-50 rounded-2xl border border-emerald-100">Queue is completely empty. Great job!</div>
          ) : (
            recentPending.map(ticket => (
              <div 
                key={ticket.complaint_id} 
                onClick={() => navigate('/supervisor-queue')}
                className="flex justify-between items-center p-4 bg-slate-50 rounded-xl border border-slate-200 hover:border-amber-300 hover:bg-amber-50/30 transition cursor-pointer group"
              >
                <div>
                  <h4 className="font-black text-brand-maroon text-sm group-hover:underline">{ticket.complaint_id}</h4>
                  <p className="text-[10px] font-bold text-slate-500 uppercase mt-0.5">{ticket.category} • {ticket.venue}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-amber-600 bg-amber-100 px-2 py-1 rounded uppercase tracking-wider">Needs Approval</span>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-amber-600 group-hover:translate-x-0.5 transition-all" />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}