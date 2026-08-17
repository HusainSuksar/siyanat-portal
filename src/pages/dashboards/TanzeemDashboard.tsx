import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {  Car, Clock, AlertTriangle, CheckCircle, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function TanzeemDashboard() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState({ pendingEvents: 0, pendingFleet: 0, scheduledEvents: 0 });
  const [actionEvents, setActionEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTanzeemData() {
      setLoading(true);
      const { count: eventsCount } = await supabase.from('events').select('*', { count: 'exact', head: true }).in('status', ['Pending', 'Pending Approval', 'Pending Tanzeem Approval', 'Not Confirmed']);
      const { count: fleetCount } = await supabase.from('vehicle_requests').select('*', { count: 'exact', head: true }).in('status', ['Pending', 'Pending Approval']);
      const { count: scheduledCount } = await supabase.from('events').select('*', { count: 'exact', head: true }).eq('status', 'Approved & Scheduled');

      setMetrics({ pendingEvents: eventsCount || 0, pendingFleet: fleetCount || 0, scheduledEvents: scheduledCount || 0 });

      const { data: recent } = await supabase.from('events').select('id, event_title, location, event_date, status').in('status', ['Pending', 'Pending Approval', 'Pending Tanzeem Approval', 'Not Confirmed']).order('created_at', { ascending: true }).limit(5);
      if (recent) setActionEvents(recent);
      setLoading(false);
    }
    fetchTanzeemData();
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
              {role?.replace('_', ' ') || 'TANZEEM HEAD'}
            </span>
          </div>
          <p className="text-sm text-slate-200 mt-2 font-medium">Tanzeem Operations & Fleet Command.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between hover:border-amber-300 transition cursor-pointer" onClick={() => navigate('/tanzeem')}>
          <div>
            <span className="text-[10px] font-extrabold uppercase text-amber-600 tracking-wider">Pending Events</span>
            <div className="text-3xl font-black text-amber-600 mt-1">{loading ? '-' : metrics.pendingEvents}</div>
          </div>
          <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center"><AlertTriangle className="w-6 h-6 text-amber-500" /></div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between hover:border-indigo-300 transition cursor-pointer" onClick={() => navigate('/tanzeem')}>
          <div>
            <span className="text-[10px] font-extrabold uppercase text-indigo-600 tracking-wider">Pending Fleet</span>
            <div className="text-3xl font-black text-indigo-600 mt-1">{loading ? '-' : metrics.pendingFleet}</div>
          </div>
          <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center"><Car className="w-6 h-6 text-indigo-500" /></div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between hover:border-emerald-300 transition cursor-pointer" onClick={() => navigate('/tanzeem')}>
          <div>
            <span className="text-[10px] font-extrabold uppercase text-emerald-600 tracking-wider">Scheduled Events</span>
            <div className="text-3xl font-black text-emerald-600 mt-1">{loading ? '-' : metrics.scheduledEvents}</div>
          </div>
          <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center"><CheckCircle className="w-6 h-6 text-emerald-500" /></div>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 mt-6">
        <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
          <Clock className="w-4 h-4 text-brand-maroon" />
          <h3 className="font-black text-sm uppercase tracking-wide text-slate-800">Action Required: Unreviewed Bookings</h3>
        </div>
        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-6 text-xs font-bold text-slate-400 animate-pulse">Scanning event queue...</div>
          ) : actionEvents.length === 0 ? (
            <div className="text-center py-8 text-xs font-bold text-emerald-600 bg-emerald-50 rounded-2xl border border-emerald-100">All requested events have been processed!</div>
          ) : (
            actionEvents.map(event => (
              <div key={event.id} className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-4 bg-slate-50 rounded-xl border border-slate-200 hover:border-brand-maroon/30 transition gap-3">
                <div>
                  <h4 className="font-black text-brand-maroon text-sm">{event.event_title}</h4>
                  <p className="text-[10px] font-bold text-slate-500 uppercase mt-0.5">{new Date(event.event_date).toLocaleDateString()} • {event.location}</p>
                </div>
                <button onClick={() => navigate('/tanzeem')} className="px-4 py-2 bg-slate-900 hover:bg-black text-white text-[10px] font-black uppercase tracking-wider rounded-lg flex items-center justify-center gap-1.5 transition">
                  Review <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}