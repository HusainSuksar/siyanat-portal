import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { BarChart3, Download, FileSpreadsheet, Package, Wrench, Calendar, Car, Trash2, } from 'lucide-react';
import { useToast } from '../hooks/useToast';
// Use strict typing
// Use strict typing
import type { WorkOrder } from '../types';

export default function Reports() {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'materials' | 'complaints' | 'events' | 'fleet'>('materials');
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Data States
  const [materials, setMaterials] = useState<WorkOrder[]>([]);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [fleet, setFleet] = useState<any[]>([]);

  // Delete Modal State
  const [deleteTarget, setDeleteTarget] = useState<{ table: string, id: string, reference: string } | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUser(data.user));
  }, []);

  // Targeted Fetching: Only fetch the table that is actively being viewed
  useEffect(() => {
    const fetchActiveData = async () => {
      setLoading(true);
      if (activeTab === 'materials') {
        const { data } = await supabase.from('work_orders').select(`*, items:work_order_items(requested_qty, item_type, custom_item_name, inventory:inventory_items(name)), requester:profiles(full_name, department)`).order('created_at', { ascending: false });
        if (data) setMaterials(data as WorkOrder[]);
      } else if (activeTab === 'complaints') {
        const { data } = await supabase.from('complaints').select(`*, requester:profiles(full_name, department)`).order('created_at', { ascending: false });
        if (data) setComplaints(data);
      } else if (activeTab === 'events') {
        const { data } = await supabase.from('events').select(`*, requester:profiles(full_name, department), requirements:event_requirements(item_name)`).order('created_at', { ascending: false });
        if (data) setEvents(data);
      } else if (activeTab === 'fleet') {
        const { data } = await supabase.from('vehicle_requests').select(`*, requester:profiles(full_name, department)`).order('created_at', { ascending: false });
        if (data) setFleet(data);
      }
      setLoading(false);
    };

    fetchActiveData();
  }, [activeTab]);

  // 🔴 GOD MODE: Universal Hard Delete (Secured with modern modal)
  const executeDelete = async () => {
    if (!deleteTarget) return;
    setProcessingId(deleteTarget.id);

    try {
      const { error } = await supabase.from(deleteTarget.table).delete().eq('id', deleteTarget.id);
      if (error) throw error;

      await supabase.from('system_logs').insert({
        action_type: 'GOD_MODE_DELETE',
        description: `Admin hard-deleted archive record ${deleteTarget.reference} from ${deleteTarget.table}.`,
        user_email: currentUser?.email || 'Admin'
      });
      
      showToast(`Record ${deleteTarget.reference} permanently eradicated.`, 'success');
      
      // Update local state directly to avoid re-fetching the whole table immediately
      if (activeTab === 'materials') setMaterials(prev => prev.filter(item => item.id !== deleteTarget.id));
      if (activeTab === 'complaints') setComplaints(prev => prev.filter(item => item.id !== deleteTarget.id));
      if (activeTab === 'events') setEvents(prev => prev.filter(item => item.id !== deleteTarget.id));
      if (activeTab === 'fleet') setFleet(prev => prev.filter(item => item.id !== deleteTarget.id));
      
    } catch (err: any) {
      showToast("Error deleting record: " + err.message, 'error');
    } finally {
      setProcessingId(null);
      setDeleteTarget(null);
    }
  };

  // --- DYNAMIC CSV EXPORT ENGINE ---
  const downloadCSV = () => {
    let headers: string[] = [];
    let rows: string[] = [];
    let filename = "";

    if (activeTab === 'materials') {
      if (materials.length === 0) return showToast("No material data to export.", 'warning');
      filename = "Materials_Report";
      headers = ["Batch ID", "Date Submitted", "Requester", "Location", "Pipeline State", "Items Requested"];
      rows = materials.map(m => {
        const itemsString = m.items?.map((i: any) => `${i.item_type === 'Catalog' && i.inventory ? i.inventory.name : i.custom_item_name} (x${i.requested_qty})`).join('; ');
        return [m.batch_id, new Date(m.created_at || '').toLocaleDateString(), m.requester?.full_name || 'N/A', m.location, m.pipeline_state, `"${itemsString}"`].join(',');
      });
    } 
    else if (activeTab === 'complaints') {
      if (complaints.length === 0) return showToast("No complaint data to export.", 'warning');
      filename = "Complaints_Report";
      headers = ["Complaint ID", "Date", "Requester", "Zone", "Venue", "Category", "Priority", "Pipeline State"];
      rows = complaints.map(c => [
        c.complaint_id, new Date(c.created_at).toLocaleDateString(), c.requester?.full_name || 'N/A', c.zone, `"${c.venue} (${c.room_area})"`, c.category, c.priority, c.pipeline_state
      ].join(','));
    }
    else if (activeTab === 'events') {
      if (events.length === 0) return showToast("No event data to export.", 'warning');
      filename = "Events_Report";
      headers = ["Event Title", "Event Date", "Time Slot", "Requester", "Location", "Total Pax", "Pipeline State"];
      rows = events.map(e => [
        `"${e.event_title}"`, new Date(e.event_date).toLocaleDateString(), e.time_slot, e.requester?.full_name || 'N/A', e.location, e.total_count, e.pipeline_state
      ].join(','));
    }
    else if (activeTab === 'fleet') {
      if (fleet.length === 0) return showToast("No fleet data to export.", 'warning');
      filename = "Fleet_Logistics_Report";
      headers = ["Destination", "Purpose", "Date", "Requester", "Total Pax", "Reach By", "Assigned Vehicles", "Pipeline State"];
      rows = fleet.map(f => [
        `"${f.destination}"`, `"${f.purpose}"`, new Date(f.request_date).toLocaleDateString(), f.requester?.full_name || 'N/A', f.total_count, f.arrival_time, `"${f.assigned_vehicles || ''}"`, f.pipeline_state
      ].join(','));
    }

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `Siyanat_${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- DYNAMIC METRICS (Updated to map pipeline_state) ---
  const getMetrics = () => {
    if (activeTab === 'materials') return {
      title1: 'Total Batches', val1: materials.length,
      title2: 'Awaiting Pickup', val2: materials.filter(m => m.pipeline_state === 'ACTION_REQUIRED').length,
      title3: 'Completed', val3: materials.filter(m => m.pipeline_state === 'CLOSED').length,
      title4: 'Rejected', val4: materials.filter(m => m.pipeline_state === 'REJECTED').length
    };
    if (activeTab === 'complaints') return {
      title1: 'Total Complaints', val1: complaints.length,
      title2: 'Resolved/Closed', val2: complaints.filter(c => c.pipeline_state === 'CLOSED').length,
      title3: 'In Progress', val3: complaints.filter(c => c.pipeline_state === 'PROCESSING').length,
      title4: 'Rejected', val4: complaints.filter(c => c.pipeline_state === 'REJECTED').length
    };
    if (activeTab === 'events') return {
      title1: 'Total Events', val1: events.length,
      title2: 'Concluded', val2: events.filter(e => e.pipeline_state === 'CLOSED').length,
      title3: 'Scheduled', val3: events.filter(e => e.pipeline_state === 'PROCESSING').length,
      title4: 'Declined', val4: events.filter(e => e.pipeline_state === 'REJECTED').length
    };
    return {
      title1: 'Total Fleet Requests', val1: fleet.length,
      title2: 'Dispatched', val2: fleet.filter(f => f.pipeline_state === 'PROCESSING').length,
      title3: 'Awaiting Assignment', val3: fleet.filter(f => f.pipeline_state === 'AUTHORIZED').length,
      title4: 'Rejected', val4: fleet.filter(f => f.pipeline_state === 'REJECTED').length
    };
  };

  const currentMetrics = getMetrics();

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-brand-maroon flex items-center gap-2">
            <BarChart3 className="w-6 h-6" />
            Global Analytics & Master Reports
          </h2>
          <p className="text-xs text-slate-500 mt-1">Export operational archives and execute administrative overrides.</p>
        </div>
        <button 
          onClick={downloadCSV}
          disabled={loading}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs shadow-md transition flex items-center space-x-2 disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          <span>Export {activeTab} CSV</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-slate-200 overflow-x-auto pb-1">
        <button onClick={() => setActiveTab('materials')} className={`px-4 py-2 text-sm font-bold border-b-2 transition whitespace-nowrap flex items-center gap-2 ${activeTab === 'materials' ? 'border-brand-maroon text-brand-maroon' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          <Package className="w-4 h-4" /> Materials
        </button>
        <button onClick={() => setActiveTab('complaints')} className={`px-4 py-2 text-sm font-bold border-b-2 transition whitespace-nowrap flex items-center gap-2 ${activeTab === 'complaints' ? 'border-brand-maroon text-brand-maroon' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          <Wrench className="w-4 h-4" /> Complaints
        </button>
        <button onClick={() => setActiveTab('events')} className={`px-4 py-2 text-sm font-bold border-b-2 transition whitespace-nowrap flex items-center gap-2 ${activeTab === 'events' ? 'border-brand-maroon text-brand-maroon' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          <Calendar className="w-4 h-4" /> Events
        </button>
        <button onClick={() => setActiveTab('fleet')} className={`px-4 py-2 text-sm font-bold border-b-2 transition whitespace-nowrap flex items-center gap-2 ${activeTab === 'fleet' ? 'border-brand-maroon text-brand-maroon' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          <Car className="w-4 h-4" /> Fleet
        </button>
      </div>

      {/* Dynamic Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
          <span className="text-[10px] font-extrabold uppercase text-slate-400">{currentMetrics.title1}</span>
          <span className="text-3xl font-black text-slate-800 mt-2">{currentMetrics.val1}</span>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
          <span className="text-[10px] font-extrabold uppercase text-emerald-600">{currentMetrics.title2}</span>
          <span className="text-3xl font-black text-emerald-600 mt-2">{currentMetrics.val2}</span>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
          <span className="text-[10px] font-extrabold uppercase text-brand-gold">{currentMetrics.title3}</span>
          <span className="text-3xl font-black text-brand-gold mt-2">{currentMetrics.val3}</span>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
          <span className="text-[10px] font-extrabold uppercase text-red-500">{currentMetrics.title4}</span>
          <span className="text-3xl font-black text-red-500 mt-2">{currentMetrics.val4}</span>
        </div>
      </div>

      {/* Historical Data View */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center space-x-2">
            <FileSpreadsheet className="w-4 h-4 text-brand-maroon" />
            <h3 className="font-extrabold text-sm uppercase text-slate-800">{activeTab} Archive</h3>
          </div>
        </div>
        
        {loading ? (
          <div className="py-10 text-center text-xs font-bold text-slate-400 animate-pulse">Syncing active archive...</div>
        ) : (
          <div className="overflow-y-auto max-h-[500px] border border-slate-100 rounded-lg">
            <table className="w-full text-left text-[11px]">
              
              {/* MATERIALS */}
              {activeTab === 'materials' && (
                <>
                  <thead className="bg-slate-50 text-slate-600 uppercase sticky top-0 shadow-sm">
                    <tr><th className="p-3">Ref ID</th><th className="p-3">Date</th><th className="p-3">Requester</th><th className="p-3">Status</th><th className="p-3 text-right">Action</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {materials.map(m => (
                      <tr key={m.id} className="hover:bg-slate-50">
                        <td className="p-3 font-bold text-brand-maroon">{m.batch_id}</td>
                        <td className="p-3 text-slate-500">{new Date(m.created_at || '').toLocaleDateString()}</td>
                        <td className="p-3 font-semibold">{m.requester?.full_name}</td>
                        <td className="p-3"><span className="px-2 py-1 rounded bg-slate-100 font-bold uppercase">{m.pipeline_state}</span></td>
                        <td className="p-3 text-right">
                          <button onClick={() => setDeleteTarget({ table: 'work_orders', id: m.id, reference: m.batch_id })} disabled={processingId === m.id} className="text-slate-400 hover:text-red-600 transition"><Trash2 className="w-4 h-4 ml-auto" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </>
              )}

              {/* COMPLAINTS */}
              {activeTab === 'complaints' && (
                <>
                  <thead className="bg-slate-50 text-slate-600 uppercase sticky top-0 shadow-sm">
                    <tr><th className="p-3">Complaint ID</th><th className="p-3">Date</th><th className="p-3">Category</th><th className="p-3">Status</th><th className="p-3 text-right">Action</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {complaints.map(c => (
                      <tr key={c.id} className="hover:bg-slate-50">
                        <td className="p-3 font-bold text-brand-maroon">{c.complaint_id}</td>
                        <td className="p-3 text-slate-500">{new Date(c.created_at).toLocaleDateString()}</td>
                        <td className="p-3 font-semibold">{c.category}</td>
                        <td className="p-3"><span className="px-2 py-1 rounded bg-slate-100 font-bold uppercase">{c.pipeline_state}</span></td>
                        <td className="p-3 text-right">
                          <button onClick={() => setDeleteTarget({ table: 'complaints', id: c.id, reference: c.complaint_id })} disabled={processingId === c.id} className="text-slate-400 hover:text-red-600 transition"><Trash2 className="w-4 h-4 ml-auto" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </>
              )}

              {/* EVENTS */}
              {activeTab === 'events' && (
                <>
                  <thead className="bg-slate-50 text-slate-600 uppercase sticky top-0 shadow-sm">
                    <tr><th className="p-3">Event Title</th><th className="p-3">Event Date</th><th className="p-3">Location</th><th className="p-3">Status</th><th className="p-3 text-right">Action</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {events.map(e => (
                      <tr key={e.id} className="hover:bg-slate-50">
                        <td className="p-3 font-bold text-brand-maroon">{e.event_title}</td>
                        <td className="p-3 text-slate-500">{new Date(e.event_date).toLocaleDateString()}</td>
                        <td className="p-3 font-semibold">{e.location}</td>
                        <td className="p-3"><span className="px-2 py-1 rounded bg-slate-100 font-bold uppercase">{e.pipeline_state}</span></td>
                        <td className="p-3 text-right">
                          <button onClick={() => setDeleteTarget({ table: 'events', id: e.id, reference: e.event_title })} disabled={processingId === e.id} className="text-slate-400 hover:text-red-600 transition"><Trash2 className="w-4 h-4 ml-auto" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </>
              )}

              {/* FLEET */}
              {activeTab === 'fleet' && (
                <>
                  <thead className="bg-slate-50 text-slate-600 uppercase sticky top-0 shadow-sm">
                    <tr><th className="p-3">Destination</th><th className="p-3">Request Date</th><th className="p-3">Reach By</th><th className="p-3">Status</th><th className="p-3 text-right">Action</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {fleet.map(f => (
                      <tr key={f.id} className="hover:bg-slate-50">
                        <td className="p-3 font-bold text-brand-maroon">{f.destination}</td>
                        <td className="p-3 text-slate-500">{new Date(f.request_date).toLocaleDateString()}</td>
                        <td className="p-3 font-semibold">{f.arrival_time}</td>
                        <td className="p-3"><span className="px-2 py-1 rounded bg-slate-100 font-bold uppercase">{f.pipeline_state}</span></td>
                        <td className="p-3 text-right">
                          <button onClick={() => setDeleteTarget({ table: 'vehicle_requests', id: f.id, reference: f.destination })} disabled={processingId === f.id} className="text-slate-400 hover:text-red-600 transition"><Trash2 className="w-4 h-4 ml-auto" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </>
              )}

            </table>
          </div>
        )}
      </div>

      {/* GOD MODE Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-2xl max-w-sm w-full text-center">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-black text-slate-800 mb-2">Eradicate Record?</h3>
            <p className="text-xs text-slate-500 mb-6 font-medium leading-relaxed">
              You are about to permanently delete <strong>{deleteTarget.reference}</strong> from the database. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition">Cancel</button>
              <button onClick={executeDelete} disabled={!!processingId} className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition disabled:opacity-50">Eradicate</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}