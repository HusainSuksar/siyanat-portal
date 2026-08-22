import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Search, Wrench, Package, Calendar, Car, Clock, User, AlertCircle, ShieldCheck, Truck, Eye, CheckCircle, X } from 'lucide-react';

export default function ReceptionWatchtower() {
  const [activeTab, setActiveTab] = useState<'complaints' | 'materials' | 'events' | 'fleet'>('complaints');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Datasets
  const [complaints, setComplaints] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [fleet, setFleet] = useState<any[]>([]);

  // Selected Item Modal
  const [viewItem, setViewItem] = useState<any | null>(null);

  const fetchOmniData = async () => {
    setLoading(true);

    const [compRes, matRes, evtRes, fleetRes] = await Promise.all([
      // Complaints
      supabase.from('complaints').select(`*, requester:profiles(full_name, department), assignments:technician_assignments(status, technician:profiles!technician_assignments_technician_id_fkey(full_name, trade))`).order('created_at', { ascending: false }),
      // Materials
      supabase.from('work_orders').select(`*, requester:profiles(full_name, department), items:work_order_items(id, requested_qty, item_type, custom_item_name, status, eta_days, inventory:inventory_items(name))`).order('created_at', { ascending: false }),
      // Events
      supabase.from('events').select(`*, requester:profiles(full_name, department)`).order('event_date', { ascending: false }),
      // Fleet
      supabase.from('vehicle_requests').select(`*, requester:profiles(full_name, department)`).order('request_date', { ascending: false })
    ]);

    if (compRes.data) setComplaints(compRes.data);
    if (matRes.data) setMaterials(matRes.data);
    if (evtRes.data) setEvents(evtRes.data);
    if (fleetRes.data) setFleet(fleetRes.data);

    setLoading(false);
  };

  useEffect(() => {
    fetchOmniData();
  }, []);

  // --- BOTTLENECK CALCULATORS ---
  const getComplaintBottleneck = (c: any) => {
    if (c.pipeline_state === 'SUBMITTED') return { text: 'Awaiting Zone Supervisor', icon: ShieldCheck, color: 'text-amber-600', bg: 'bg-amber-100' };
    if (c.pipeline_state === 'PROCESSING') {
      const tech = c.assignments?.[0]?.technician?.full_name;
      return tech 
        ? { text: `With Tech: ${tech}`, icon: Wrench, color: 'text-indigo-600', bg: 'bg-indigo-100' }
        : { text: 'Awaiting Siyanat Assignment', icon: Clock, color: 'text-orange-600', bg: 'bg-orange-100' };
    }
    if (c.pipeline_state === 'ACTION_REQUIRED') return { text: 'Awaiting Supervisor Sign-off', icon: ShieldCheck, color: 'text-emerald-600', bg: 'bg-emerald-100' };
    if (c.pipeline_state === 'CLOSED') return { text: 'Completed', icon: CheckCircle, color: 'text-slate-500', bg: 'bg-slate-100' };
    return { text: 'Rejected/Closed', icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-100' };
  };

  const getMaterialBottleneck = (m: any) => {
    if (m.pipeline_state === 'AUTHORIZED') return { text: 'Awaiting Dept Head Review', icon: Clock, color: 'text-orange-600', bg: 'bg-orange-100' };
    if (m.pipeline_state === 'PROCESSING') return { text: 'Awaiting Vendor PO / Stock', icon: Truck, color: 'text-indigo-600', bg: 'bg-indigo-100' };
    if (m.pipeline_state === 'ACTION_REQUIRED') return { text: 'Awaiting Requester Pickup', icon: User, color: 'text-emerald-600', bg: 'bg-emerald-100' };
    return { text: m.pipeline_state, icon: Package, color: 'text-slate-500', bg: 'bg-slate-100' };
  };

  const getFleetBottleneck = (f: any) => {
    if (f.pipeline_state === 'AUTHORIZED' && !f.assigned_vehicles) return { text: 'Awaiting Tanzeem Fleet Engine', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-100' };
    if (f.assigned_vehicles) return { text: `Assigned: ${f.assigned_vehicles}`, icon: Car, color: 'text-emerald-600', bg: 'bg-emerald-100' };
    return { text: f.pipeline_state, icon: AlertCircle, color: 'text-slate-500', bg: 'bg-slate-100' };
  };

  // --- SEARCH FILTERING ---
  const filteredComplaints = complaints.filter(c => c.complaint_id?.toLowerCase().includes(searchQuery.toLowerCase()) || c.requester?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredMaterials = materials.filter(m => m.batch_id?.toLowerCase().includes(searchQuery.toLowerCase()) || m.requester?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredEvents = events.filter(e => e.event_title?.toLowerCase().includes(searchQuery.toLowerCase()) || e.requester?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredFleet = fleet.filter(f => f.destination?.toLowerCase().includes(searchQuery.toLowerCase()) || f.requester?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()));

  // --- COMPONENT HELPERS ---
  const StatusPill = ({ bottleneck }: { bottleneck: any }) => {
    const Icon = bottleneck.icon;
    return (
      <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${bottleneck.bg} ${bottleneck.color} border border-black/5`}>
        <Icon className="w-3.5 h-3.5" />
        <span className="text-[10px] font-black uppercase tracking-wider">{bottleneck.text}</span>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-24">
      {/* HEADER & SEARCH */}
      <div className="bg-slate-900 rounded-3xl p-6 md:p-8 shadow-xl text-white flex flex-col md:flex-row justify-between items-center gap-6">
        <div>
          <h2 className="text-2xl font-black tracking-tight flex items-center gap-3">
            <Eye className="w-7 h-7 text-brand-gold" /> Omni-Tracker Watchtower
          </h2>
          <p className="text-sm font-medium text-slate-400 mt-1">Reception & Follow-up Command Center</p>
        </div>
        <div className="relative w-full md:w-96">
          <Search className="w-5 h-5 absolute left-4 top-3.5 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search ID, Requester, or Event..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3.5 bg-slate-800 border border-slate-700 rounded-2xl text-sm font-bold text-white placeholder-slate-400 focus:ring-2 focus:ring-brand-gold outline-none transition"
          />
        </div>
      </div>

      {/* TABS */}
      <div className="flex space-x-2 border-b border-slate-200 overflow-x-auto pb-1">
        <button onClick={() => setActiveTab('complaints')} className={`px-5 py-3 text-xs uppercase tracking-widest font-black border-b-2 transition flex items-center gap-2 whitespace-nowrap ${activeTab === 'complaints' ? 'border-brand-maroon text-brand-maroon' : 'border-transparent text-slate-400 hover:text-slate-700'}`}>
          <Wrench className="w-4 h-4" /> Complaints ({filteredComplaints.length})
        </button>
        <button onClick={() => setActiveTab('materials')} className={`px-5 py-3 text-xs uppercase tracking-widest font-black border-b-2 transition flex items-center gap-2 whitespace-nowrap ${activeTab === 'materials' ? 'border-brand-maroon text-brand-maroon' : 'border-transparent text-slate-400 hover:text-slate-700'}`}>
          <Package className="w-4 h-4" /> Materials ({filteredMaterials.length})
        </button>
        <button onClick={() => setActiveTab('events')} className={`px-5 py-3 text-xs uppercase tracking-widest font-black border-b-2 transition flex items-center gap-2 whitespace-nowrap ${activeTab === 'events' ? 'border-brand-maroon text-brand-maroon' : 'border-transparent text-slate-400 hover:text-slate-700'}`}>
          <Calendar className="w-4 h-4" /> Events ({filteredEvents.length})
        </button>
        <button onClick={() => setActiveTab('fleet')} className={`px-5 py-3 text-xs uppercase tracking-widest font-black border-b-2 transition flex items-center gap-2 whitespace-nowrap ${activeTab === 'fleet' ? 'border-brand-maroon text-brand-maroon' : 'border-transparent text-slate-400 hover:text-slate-700'}`}>
          <Car className="w-4 h-4" /> Fleet ({filteredFleet.length})
        </button>
      </div>

      {/* CONTENT ENGINE */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 font-bold animate-pulse">Scanning entire database...</div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          
          {/* COMPLAINTS TAB */}
          {activeTab === 'complaints' && filteredComplaints.map(c => (
            <div key={c.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:shadow-md transition">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <span className="font-black text-brand-maroon text-sm">{c.complaint_id}</span>
                  <StatusPill bottleneck={getComplaintBottleneck(c)} />
                </div>
                <h3 className="font-bold text-slate-800">{c.category} Issue <span className="text-slate-400 font-normal">in {c.zone} ({c.venue})</span></h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-2 flex items-center gap-1">
                  <User className="w-3 h-3" /> {c.requester?.full_name} • {new Date(c.created_at).toLocaleDateString()}
                </p>
              </div>
              <button onClick={() => setViewItem({ type: 'complaint', data: c })} className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black uppercase tracking-wider rounded-xl transition w-full md:w-auto shrink-0">
                View Details
              </button>
            </div>
          ))}

          {/* MATERIALS TAB */}
          {activeTab === 'materials' && filteredMaterials.map(m => (
            <div key={m.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:shadow-md transition">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <span className="font-black text-brand-maroon text-sm">{m.batch_id}</span>
                  <StatusPill bottleneck={getMaterialBottleneck(m)} />
                </div>
                <h3 className="font-bold text-slate-800">Requisition for {m.location}</h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-2 flex items-center gap-1">
                  <User className="w-3 h-3" /> {m.requester?.full_name} • {m.items?.length || 0} Items Requested
                </p>
              </div>
              <button onClick={() => setViewItem({ type: 'material', data: m })} className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black uppercase tracking-wider rounded-xl transition w-full md:w-auto shrink-0">
                View Details
              </button>
            </div>
          ))}

          {/* EVENTS TAB */}
          {activeTab === 'events' && filteredEvents.map(e => (
            <div key={e.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:shadow-md transition">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <span className="font-black text-brand-maroon text-sm">{new Date(e.event_date).toLocaleDateString()}</span>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-100 text-indigo-700 border border-black/5">
                    <span className="text-[10px] font-black uppercase tracking-wider">{e.time_slot}</span>
                  </div>
                </div>
                <h3 className="font-bold text-slate-800">{e.event_title} <span className="text-slate-400 font-normal">at {e.location}</span></h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-2 flex items-center gap-1">
                  <User className="w-3 h-3" /> {e.requester?.full_name} • Pax: {e.total_count}
                </p>
              </div>
              <button onClick={() => setViewItem({ type: 'event', data: e })} className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black uppercase tracking-wider rounded-xl transition w-full md:w-auto shrink-0">
                View Details
              </button>
            </div>
          ))}

          {/* FLEET TAB */}
          {activeTab === 'fleet' && filteredFleet.map(f => (
            <div key={f.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:shadow-md transition">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <span className="font-black text-brand-maroon text-sm">{new Date(f.request_date).toLocaleDateString()}</span>
                  <StatusPill bottleneck={getFleetBottleneck(f)} />
                </div>
                <h3 className="font-bold text-slate-800 truncate max-w-xl">{f.destination}</h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-2 flex items-center gap-1">
                  <User className="w-3 h-3" /> {f.requester?.full_name} • Arrive By: {f.arrival_time}
                </p>
              </div>
              <button onClick={() => setViewItem({ type: 'fleet', data: f })} className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black uppercase tracking-wider rounded-xl transition w-full md:w-auto shrink-0">
                View Details
              </button>
            </div>
          ))}

        </div>
      )}

      {/* --- READ ONLY DEEP DIVE MODAL --- */}
      {viewItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-slate-900 p-5 flex justify-between items-center text-white shrink-0">
              <h3 className="font-extrabold text-sm uppercase tracking-widest">Record Details (Read Only)</h3>
              <button onClick={() => setViewItem(null)} className="p-1 hover:bg-white/20 rounded-lg transition"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[70vh]">
              {/* Complaint Format */}
              {viewItem.type === 'complaint' && (
                <div className="space-y-4">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <p className="text-xs font-bold text-slate-500 uppercase mb-1">Description</p>
                    <p className="text-sm font-semibold text-slate-800">{viewItem.data.description}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                     <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                       <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Floor & Room</p>
                       <p className="text-sm font-black text-slate-800">{viewItem.data.floor} • {viewItem.data.room_area}</p>
                     </div>
                     <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                       <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Contact Details</p>
                       <p className="text-sm font-black text-slate-800">{viewItem.data.requester?.full_name}</p>
                       {viewItem.data.student_tr_no && <p className="text-xs font-bold text-indigo-600 mt-1">TR: {viewItem.data.student_tr_no}</p>}
                     </div>
                  </div>
                </div>
              )}

              {/* Material Format */}
              {viewItem.type === 'material' && (
                <div className="space-y-4">
                  <h4 className="text-xs font-black uppercase text-slate-400 tracking-widest border-b border-slate-100 pb-2">Requested Items</h4>
                  {viewItem.data.items?.map((i: any) => (
                    <div key={i.id} className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <span className="text-sm font-bold text-slate-800">{i.inventory?.name || i.custom_item_name}</span>
                      <span className="text-xs font-black text-brand-maroon">Qty: {i.requested_qty}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Event Format */}
              {viewItem.type === 'event' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                       <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Sub Location</p>
                       <p className="text-sm font-black text-slate-800">{viewItem.data.sub_location || 'N/A'}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                       <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Audience</p>
                       <p className="text-sm font-black text-slate-800">Class {viewItem.data.darajah} • {viewItem.data.total_count} Pax</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Fleet Format */}
              {viewItem.type === 'fleet' && (
                <div className="space-y-4">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <p className="text-xs font-bold text-slate-500 uppercase mb-1">Full Route details</p>
                    <p className="text-sm font-semibold text-slate-800 whitespace-pre-wrap">{viewItem.data.destination}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                       <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Passengers</p>
                       <p className="text-sm font-black text-slate-800">{viewItem.data.total_count} Pax</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                       <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Timing</p>
                       <p className="text-sm font-black text-slate-800">Arr: {viewItem.data.arrival_time} <br/> Rel: {viewItem.data.release_time || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}