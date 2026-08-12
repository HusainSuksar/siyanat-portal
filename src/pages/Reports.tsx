import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { BarChart3, Download, FileSpreadsheet, Package, Wrench, Calendar, Car, Trash2 } from 'lucide-react';

export default function Reports() {
  const [activeTab, setActiveTab] = useState<'materials' | 'complaints' | 'events' | 'fleet'>('materials');
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Data States
  const [materials, setMaterials] = useState<any[]>([]);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [fleet, setFleet] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
    supabase.auth.getUser().then(({ data }) => setCurrentUser(data.user));
  }, []);

  const fetchData = async () => {
    setLoading(true);
    
    const [matRes, compRes, evRes, fleetRes] = await Promise.all([
      supabase.from('work_orders').select(`*, items:work_order_items(requested_qty, item_type, custom_item_name, inventory:inventory_items(name)), requester:profiles(full_name, department)`).order('created_at', { ascending: false }),
      supabase.from('complaints').select(`*, requester:profiles(full_name, department)`).order('created_at', { ascending: false }),
      supabase.from('events').select(`*, requester:profiles(full_name, department), requirements:event_requirements(item_name)`).order('created_at', { ascending: false }),
      supabase.from('vehicle_requests').select(`*, requester:profiles(full_name, department)`).order('created_at', { ascending: false })
    ]);

    if (matRes.data) setMaterials(matRes.data);
    if (compRes.data) setComplaints(compRes.data);
    if (evRes.data) setEvents(evRes.data);
    if (fleetRes.data) setFleet(fleetRes.data);

    setLoading(false);
  };

  // 🔴 GOD MODE: Universal Hard Delete
  const deleteRecord = async (table: string, id: string, reference: string) => {
    if (!confirm(`GOD MODE WARNING: Are you sure you want to permanently erase [${reference}] from the ${table} archives? This cannot be undone.`)) return;
    
    setProcessingId(id);
    const { error } = await supabase.from(table).delete().eq('id', id);
    
    if (!error) {
      await supabase.from('system_logs').insert({
        action_type: 'GOD_MODE_DELETE',
        description: `Admin hard-deleted archive record ${reference} from ${table}.`,
        user_email: currentUser?.email || 'Admin'
      });
      alert('Record permanently deleted.');
      fetchData();
    } else {
      alert("Error deleting record: " + error.message);
    }
    setProcessingId(null);
  };

  // --- DYNAMIC CSV EXPORT ENGINE ---
  const downloadCSV = () => {
    let headers: string[] = [];
    let rows: string[] = [];
    let filename = "";

    if (activeTab === 'materials') {
      if (materials.length === 0) return alert("No material data to export.");
      filename = "Materials_Report";
      headers = ["Batch ID", "Date Submitted", "Requester", "Department", "Location", "Urgency", "Approval Status", "Dispatch Status", "Items Requested"];
      rows = materials.map(m => {
        const itemsString = m.items?.map((i: any) => `${i.item_type === 'Catalog' && i.inventory ? i.inventory.name : i.custom_item_name} (x${i.requested_qty})`).join('; ');
        return [m.batch_id, new Date(m.created_at).toLocaleDateString(), m.requester?.full_name || 'N/A', m.department, m.location, m.urgency, m.approval_status, m.dispatch_status, `"${itemsString}"`].join(',');
      });
    } 
    else if (activeTab === 'complaints') {
      if (complaints.length === 0) return alert("No complaint data to export.");
      filename = "Complaints_Report";
      headers = ["Complaint ID", "Date", "Requester", "Zone", "Venue", "Category", "Priority", "Status", "Resolution Remarks/Rejection"];
      rows = complaints.map(c => [
        c.complaint_id, new Date(c.created_at).toLocaleDateString(), c.requester?.full_name || 'N/A', c.zone, `${c.venue} (${c.room_area})`, c.category, c.priority, c.status, `"${c.rejection_reason || c.resolution_remarks || ''}"`
      ].join(','));
    }
    else if (activeTab === 'events') {
      if (events.length === 0) return alert("No event data to export.");
      filename = "Events_Report";
      headers = ["Event Title", "Event Date", "Time Slot", "Requester", "Location", "Darajah", "Total Pax", "Status"];
      rows = events.map(e => [
        `"${e.event_title}"`, new Date(e.event_date).toLocaleDateString(), e.time_slot, e.requester?.full_name || 'N/A', e.location, e.darajah, e.total_count, e.status
      ].join(','));
    }
    else if (activeTab === 'fleet') {
      if (fleet.length === 0) return alert("No fleet data to export.");
      filename = "Fleet_Logistics_Report";
      headers = ["Destination", "Purpose", "Date", "Requester", "Total Pax", "Reach By", "Assigned Vehicles", "Status"];
      rows = fleet.map(f => [
        `"${f.destination}"`, `"${f.purpose}"`, new Date(f.request_date).toLocaleDateString(), f.requester?.full_name || 'N/A', f.total_count, f.arrival_time, `"${f.assigned_vehicles || ''}"`, f.status
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

  // --- DYNAMIC METRICS ---
  const getMetrics = () => {
    if (activeTab === 'materials') return {
      title1: 'Total Batches', val1: materials.length,
      title2: 'Dispatched', val2: materials.filter(m => m.dispatch_status === 'Dispatched' || m.dispatch_status === 'Received').length,
      title3: 'Approval Rate', val3: materials.length > 0 ? `${Math.round((materials.filter(m => m.approval_status === 'Approved').length / materials.length) * 100)}%` : '0%',
      title4: 'Rejected', val4: materials.filter(m => m.approval_status === 'Rejected').length
    };
    if (activeTab === 'complaints') return {
      title1: 'Total Complaints', val1: complaints.length,
      title2: 'Resolved/Closed', val2: complaints.filter(c => ['Verified', 'Closed'].includes(c.status)).length,
      title3: 'Urgent Issues', val3: complaints.filter(c => c.priority.includes('URGENT')).length,
      title4: 'Rejected', val4: complaints.filter(c => c.status === 'Rejected' || c.status === 'Not Processed').length
    };
    if (activeTab === 'events') return {
      title1: 'Total Events', val1: events.length,
      title2: 'Approved', val2: events.filter(e => e.status === 'Approved & Scheduled').length,
      title3: 'Pending', val3: events.filter(e => e.status.includes('Pending')).length,
      title4: 'Declined', val4: events.filter(e => e.status === 'Not Confirmed').length
    };
    return {
      title1: 'Total Fleet Requests', val1: fleet.length,
      title2: 'Dispatched', val2: fleet.filter(f => f.status === 'Fleet Dispatched').length,
      title3: 'Pending', val3: fleet.filter(f => f.status.includes('Pending')).length,
      title4: 'Not Serviced', val4: fleet.filter(f => f.status === 'Not Serviced').length
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
          <div className="py-10 text-center text-xs font-bold text-slate-400 animate-pulse">Compiling database...</div>
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
                        <td className="p-3 text-slate-500">{new Date(m.created_at).toLocaleDateString()}</td>
                        <td className="p-3 font-semibold">{m.requester?.full_name}</td>
                        <td className="p-3">{m.dispatch_status}</td>
                        <td className="p-3 text-right">
                          <button onClick={() => deleteRecord('work_orders', m.id, m.batch_id)} disabled={processingId === m.id} className="text-slate-400 hover:text-red-600 transition"><Trash2 className="w-4 h-4 ml-auto" /></button>
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
                        <td className="p-3">{c.status}</td>
                        <td className="p-3 text-right">
                          <button onClick={() => deleteRecord('complaints', c.id, c.complaint_id)} disabled={processingId === c.id} className="text-slate-400 hover:text-red-600 transition"><Trash2 className="w-4 h-4 ml-auto" /></button>
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
                        <td className="p-3">{e.status}</td>
                        <td className="p-3 text-right">
                          <button onClick={() => deleteRecord('events', e.id, e.event_title)} disabled={processingId === e.id} className="text-slate-400 hover:text-red-600 transition"><Trash2 className="w-4 h-4 ml-auto" /></button>
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
                        <td className="p-3">{f.status}</td>
                        <td className="p-3 text-right">
                          <button onClick={() => deleteRecord('vehicle_requests', f.id, f.destination)} disabled={processingId === f.id} className="text-slate-400 hover:text-red-600 transition"><Trash2 className="w-4 h-4 ml-auto" /></button>
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
    </div>
  );
}