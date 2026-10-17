import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ShoppingCart, Truck, Clock, AlertTriangle, SplitSquareHorizontal, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ActionBatch {
  batch_id: string;
  department: string;
  location: string;
  created_at: string;
  items?: { fulfillment_dept: string }[];
}

export default function SiyanatDashboard() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState({ pendingDispatch: 0, pendingRTO: 0, activePOs: 0, pendingEventSetups: 0 });
  const [actionBatches, setActionBatches] = useState<ActionBatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSiyanatData() {
      setLoading(true);
      const currentRole = role || 'SIYANAT_HEAD';

      // 1. Fetch live counts for Siyanat KPIs
      let dispatchQuery = supabase.from('work_orders').select('*, items:work_order_items!inner(fulfillment_dept)', { count: 'exact', head: true }).eq('pipeline_state', 'AUTHORIZED');
      if (currentRole === 'SIYANAT_HEAD') dispatchQuery = dispatchQuery.eq('items.fulfillment_dept', 'SIYANAT_HEAD');
      else if (currentRole === 'AVIT_HEAD') dispatchQuery = dispatchQuery.eq('items.fulfillment_dept', 'AVIT_HEAD');
      
      const { count: dispatchCount } = await dispatchQuery;
      
      const { count: rtoCount } = await supabase.from('work_order_items').select('*', { count: 'exact', head: true }).eq('status', 'Pending');
      const { count: poCount } = await supabase.from('purchase_orders').select('*', { count: 'exact', head: true }).eq('status', 'PO Issued');

      // Fetch active event setups pending this department's acknowledgment
      const { data: eventData } = await supabase
        .from('events')
        .select('siyanat_status, avit_status')
        .in('pipeline_state', ['PROCESSING', 'AUTHORIZED']);

      let eventSetupsCount = 0;
      if (eventData) {
        eventSetupsCount = eventData.filter(e => {
          if (currentRole === 'SIYANAT_HEAD') {
            return e.siyanat_status && e.siyanat_status !== 'Acknowledged' && e.siyanat_status !== 'Not Required';
          }
          if (currentRole === 'AVIT_HEAD') {
            return e.avit_status && e.avit_status !== 'Acknowledged' && e.avit_status !== 'Not Required';
          }
          return (e.siyanat_status && e.siyanat_status !== 'Acknowledged' && e.siyanat_status !== 'Not Required') ||
                 (e.avit_status && e.avit_status !== 'Acknowledged' && e.avit_status !== 'Not Required');
        }).length;
      }

      setMetrics({ 
        pendingDispatch: dispatchCount || 0, 
        pendingRTO: rtoCount || 0, 
        activePOs: poCount || 0,
        pendingEventSetups: eventSetupsCount
      });

      // 2. Fetch action required batches
      let actionQuery = supabase.from('work_orders').select('batch_id, department, location, created_at, items:work_order_items!inner(fulfillment_dept)').eq('pipeline_state', 'AUTHORIZED').order('created_at', { ascending: true }).limit(5);
      if (currentRole === 'SIYANAT_HEAD') actionQuery = actionQuery.eq('items.fulfillment_dept', 'SIYANAT_HEAD');
      else if (currentRole === 'AVIT_HEAD') actionQuery = actionQuery.eq('items.fulfillment_dept', 'AVIT_HEAD');

      const { data: recent } = await actionQuery;
      if (recent) setActionBatches(recent);
      
      setLoading(false);
    }
    fetchSiyanatData();
  }, [role]);

  return (
    <div className="space-y-6 pb-24 max-w-6xl mx-auto animate-in fade-in duration-500">
      
      {/* Unified Maroon Welcome Banner */}
      <div className="bg-gradient-to-r from-brand-maroon to-brand-dark rounded-3xl p-6 md:p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-gold opacity-5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl md:text-3xl font-black text-brand-gold tracking-tight">My Dashboard</h2>
            <span className="px-3 py-1 bg-brand-gold/20 text-brand-gold text-[9px] font-black uppercase tracking-widest rounded-lg border border-brand-gold/50 shadow-sm">
              {role?.replace('_', ' ') || 'SIYANAT HEAD'}
            </span>
          </div>
          <p className="text-sm text-slate-200 mt-2 font-medium">Siyanat Operations & Logistics Oversight.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between hover:border-emerald-300 transition cursor-pointer" onClick={() => navigate('/siyanat-operations')}>
          <div>
            <span className="text-[10px] font-extrabold uppercase text-emerald-600 tracking-wider">Pending Batches</span>
            <div className="text-3xl font-black text-emerald-600 mt-1">{loading ? '-' : metrics.pendingDispatch}</div>
          </div>
          <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center"><Truck className="w-6 h-6 text-emerald-500" /></div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between hover:border-purple-300 transition cursor-pointer" onClick={() => navigate('/siyanat-operations?tab=event_setups')}>
          <div>
            <span className="text-[10px] font-extrabold uppercase text-purple-600 tracking-wider">Event Setups</span>
            <div className="text-3xl font-black text-purple-600 mt-1">{loading ? '-' : metrics.pendingEventSetups}</div>
          </div>
          <div className="w-12 h-12 bg-purple-50 rounded-full flex items-center justify-center"><Calendar className="w-6 h-6 text-purple-500" /></div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between hover:border-amber-300 transition cursor-pointer" onClick={() => navigate('/rto')}>
          <div>
            <span className="text-[10px] font-extrabold uppercase text-amber-600 tracking-wider">RTO Queue (Pending)</span>
            <div className="text-3xl font-black text-amber-600 mt-1">{loading ? '-' : metrics.pendingRTO}</div>
          </div>
          <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center"><AlertTriangle className="w-6 h-6 text-amber-500" /></div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between hover:border-indigo-300 transition cursor-pointer" onClick={() => navigate('/restock')}>
          <div>
            <span className="text-[10px] font-extrabold uppercase text-indigo-600 tracking-wider">Active POs (Awaiting)</span>
            <div className="text-3xl font-black text-indigo-600 mt-1">{loading ? '-' : metrics.activePOs}</div>
          </div>
          <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center"><ShoppingCart className="w-6 h-6 text-indigo-500" /></div>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 mt-6">
        <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
          <Clock className="w-4 h-4 text-brand-maroon" />
          <h3 className="font-black text-sm uppercase tracking-wide text-slate-800">Action Required: Unreviewed Material Batches</h3>
        </div>
        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-6 text-xs font-bold text-slate-400 animate-pulse">Scanning batches...</div>
          ) : actionBatches.length === 0 ? (
            <div className="text-center py-8 text-xs font-bold text-emerald-600 bg-emerald-50 rounded-2xl border border-emerald-100">All material requests have been reviewed and split!</div>
          ) : (
            actionBatches.map(batch => (
              <div key={batch.batch_id} className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-4 bg-slate-50 rounded-xl border border-slate-200 hover:border-brand-maroon/30 transition gap-3">
                <div>
                  <h4 className="font-black text-brand-maroon text-sm">{batch.batch_id}</h4>
                  <p className="text-[10px] font-bold text-slate-500 uppercase mt-0.5">{batch.department} • {batch.location}</p>
                </div>
                <button onClick={() => navigate('/siyanat-operations')} className="px-4 py-2 bg-slate-900 hover:bg-black text-white text-[10px] font-black uppercase tracking-wider rounded-lg flex items-center justify-center gap-1.5 transition">
                  <SplitSquareHorizontal className="w-3.5 h-3.5" /> Split Batch
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}