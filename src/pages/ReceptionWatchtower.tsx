import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Search, Wrench, Package, Calendar, Car, Clock, 
  User, AlertCircle, ShieldCheck, Truck, Eye, CheckCircle, X, Layers 
} from 'lucide-react';

export default function ReceptionWatchtower() {
  const [activeTab, setActiveTab] = useState<'all' | 'complaints' | 'materials' | 'events' | 'fleet'>('all');
  const [historyFilter, setHistoryFilter] = useState<'all' | 'active' | 'closed'>('all');
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
      supabase.from('vehicle_requests').select(`*, requester:profiles(full_name, department)`).order('created_at', { ascending: false })
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
    if (c.pipeline_state === 'AUTHORIZED') return { text: 'Approved • Awaiting Tech Assignment', icon: Clock, color: 'text-blue-600', bg: 'bg-blue-100' };
    if (c.pipeline_state === 'PROCESSING') {
      const tech = c.assignments?.[0]?.technician?.full_name;
      return tech 
        ? { text: `With Tech: ${tech}`, icon: Wrench, color: 'text-indigo-600', bg: 'bg-indigo-100' }
        : { text: 'In Progress', icon: Clock, color: 'text-orange-600', bg: 'bg-orange-100' };
    }
    if (c.pipeline_state === 'ACTION_REQUIRED') return { text: 'Awaiting Supervisor Sign-off', icon: ShieldCheck, color: 'text-emerald-600', bg: 'bg-emerald-100' };
    if (c.pipeline_state === 'CLOSED') return { text: 'Completed', icon: CheckCircle, color: 'text-slate-500', bg: 'bg-slate-100' };
    return { text: 'Rejected / Cancelled', icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-100' };
  };

  const getMaterialBottleneck = (m: any) => {
    if (m.pipeline_state === 'SUBMITTED' || m.pipeline_state === 'AUTHORIZED') return { text: 'Awaiting Dept Head Review', icon: Clock, color: 'text-orange-600', bg: 'bg-orange-100' };
    if (m.pipeline_state === 'PROCESSING') return { text: 'Awaiting Vendor PO / Stock', icon: Truck, color: 'text-indigo-600', bg: 'bg-indigo-100' };
    if (m.pipeline_state === 'ACTION_REQUIRED') return { text: 'Ready for Pickup / Delivery', icon: User, color: 'text-emerald-600', bg: 'bg-emerald-100' };
    if (m.pipeline_state === 'CLOSED') return { text: 'Completed', icon: CheckCircle, color: 'text-slate-500', bg: 'bg-slate-100' };
    return { text: m.pipeline_state, icon: Package, color: 'text-slate-500', bg: 'bg-slate-100' };
  };

  const getEventBottleneck = (e: any) => {
    if (e.pipeline_state === 'SUBMITTED' || e.pipeline_state === 'AUTHORIZED') return { text: 'Awaiting Tanzeem Head', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-100' };
    if (e.pipeline_state === 'PROCESSING') return { text: 'Confirmed & Scheduled', icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-100' };
    if (e.pipeline_state === 'CLOSED') return { text: 'Event Concluded', icon: CheckCircle, color: 'text-slate-500', bg: 'bg-slate-100' };
    return { text: e.pipeline_state, icon: AlertCircle, color: 'text-slate-500', bg: 'bg-slate-100' };
  };

  const getFleetBottleneck = (f: any) => {
    if ((f.pipeline_state === 'SUBMITTED' || f.pipeline_state === 'AUTHORIZED') && !f.assigned_vehicles) {
      return { text: 'Awaiting Fleet Allocation', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-100' };
    }
    if (f.assigned_vehicles) return { text: `Assigned: ${f.assigned_vehicles}`, icon: Car, color: 'text-emerald-600', bg: 'bg-emerald-100' };
    if (f.pipeline_state === 'CLOSED') return { text: 'Trip Completed', icon: CheckCircle, color: 'text-slate-500', bg: 'bg-slate-100' };
    return { text: f.pipeline_state, icon: AlertCircle, color: 'text-slate-500', bg: 'bg-slate-100' };
  };

  // --- OMNI SEARCH & HISTORY FILTER ---
  const matchesQuery = (target: string | undefined | null) => {
    if (!target) return false;
    return target.toLowerCase().includes(searchQuery.trim().toLowerCase());
  };

  const matchesHistory = (state: string) => {
    if (historyFilter === 'all') return true;
    if (historyFilter === 'active') return !['CLOSED', 'REJECTED'].includes(state);
    if (historyFilter === 'closed') return ['CLOSED', 'REJECTED'].includes(state);
    return true;
  };

  const filteredComplaints = complaints.filter(c => 
    matchesHistory(c.pipeline_state) &&
    (!searchQuery || matchesQuery(c.complaint_id) || matchesQuery(c.id) || matchesQuery(c.requester?.full_name) || matchesQuery(c.category) || matchesQuery(c.venue) || matchesQuery(c.description))
  );

  const filteredMaterials = materials.filter(m => 
    matchesHistory(m.pipeline_state) &&
    (!searchQuery || matchesQuery(m.batch_id) || matchesQuery(m.id) || matchesQuery(m.requester?.full_name) || matchesQuery(m.location) || matchesQuery(m.department))
  );

  const filteredEvents = events.filter(e => 
    matchesHistory(e.pipeline_state) &&
    (!searchQuery || matchesQuery(e.event_title) || matchesQuery(e.id) || matchesQuery(e.requester?.full_name) || matchesQuery(e.location))
  );

  const filteredFleet = fleet.filter(f => 
    matchesHistory(f.pipeline_state) &&
    (!searchQuery || matchesQuery(f.destination) || matchesQuery(f.id) || matchesQuery(f.purpose) || matchesQuery(f.requester?.full_name))
  );

  // Status Pill Component
  const StatusPill = ({ bottleneck }: { bottleneck: any }) => {
    const Icon = bottleneck.icon;
    return (
      <div className={`flex items-center gap-1.5 px-3 py-1 rounded-lg ${bottleneck.bg} ${bottleneck.color} border border-black/5`}>
        <Icon className="w-3.5 h-3.5" />
        <span className="text-[10px] font-black uppercase tracking-wider">{bottleneck.text}</span>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-24">
      {/* HEADER & OMNI-SEARCH */}
      <div className="bg-slate-900 rounded-3xl p-6 md:p-8 shadow-xl text-white flex flex-col md:flex-row justify-between items-center gap-6">
        <div>
          <h2 className="text-2xl font-black tracking-tight flex items-center gap-3">
            <Eye className="w-7 h-7 text-brand-gold" /> Omni-Tracker Watchtower
          </h2>
          <p className="text-sm font-medium text-slate-400 mt-1">Reception & Follow-up Master Database</p>
        </div>
        <div className="relative w-full md:w-96">
          <Search className="w-5 h-5 absolute left-4 top-3.5 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search ANY ID, Name, Venue, Batch..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3.5 bg-slate-800 border border-slate-700 rounded-2xl text-sm font-bold text-white placeholder-slate-400 focus:ring-2 focus:ring-brand-gold outline-none transition"
          />
        </div>
      </div>

      {/* FILTER CONTROLS */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
        {/* Category Tabs */}
        <div className="flex space-x-1 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          <button onClick={() => setActiveTab('all')} className={`px-4 py-2 text-xs uppercase tracking-wider font-black rounded-xl transition flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'all' ? 'bg-brand-maroon text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>
            <Layers className="w-3.5 h-3.5" /> All ({filteredComplaints.length + filteredMaterials.length + filteredEvents.length + filteredFleet.length})
          </button>
          <button onClick={() => setActiveTab('complaints')} className={`px-4 py-2 text-xs uppercase tracking-wider font-black rounded-xl transition flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'complaints' ? 'bg-brand-maroon text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>
            <Wrench className="w-3.5 h-3.5" /> Complaints ({filteredComplaints.length})
          </button>
          <button onClick={() => setActiveTab('materials')} className={`px-4 py-2 text-xs uppercase tracking-wider font-black rounded-xl transition flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'materials' ? 'bg-brand-maroon text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>
            <Package className="w-3.5 h-3.5" /> Materials ({filteredMaterials.length})
          </button>
          <button onClick={() => setActiveTab('events')} className={`px-4 py-2 text-xs uppercase tracking-wider font-black rounded-xl transition flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'events' ? 'bg-brand-maroon text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>
            <Calendar className="w-3.5 h-3.5" /> Events ({filteredEvents.length})
          </button>
          <button onClick={() => setActiveTab('fleet')} className={`px-4 py-2 text-xs uppercase tracking-wider font-black rounded-xl transition flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'fleet' ? 'bg-brand-maroon text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>
            <Car className="w-3.5 h-3.5" /> Fleet ({filteredFleet.length})
          </button>
        </div>

        {/* State Toggle: All vs Active vs Closed */}
        <div className="flex bg-slate-100 p-1 rounded-xl self-end sm:self-auto shrink-0">
          <button onClick={() => setHistoryFilter('all')} className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-lg transition ${historyFilter === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>All History</button>
          <button onClick={() => setHistoryFilter('active')} className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-lg transition ${historyFilter === 'active' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}>Active</button>
          <button onClick={() => setHistoryFilter('closed')} className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-lg transition ${historyFilter === 'closed' ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-500'}`}>Closed</button>
        </div>
      </div>

      {/* CONTENT ENGINE */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 font-bold animate-pulse bg-white rounded-3xl border border-slate-200">Scanning complete institutional records...</div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          
          {/* 1. COMPLAINTS */}
          {(activeTab === 'all' || activeTab === 'complaints') && filteredComplaints.map(c => (
            <div key={c.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:shadow-md transition">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <span className="font-black text-brand-maroon text-sm">{c.complaint_id}</span>
                  <StatusPill bottleneck={getComplaintBottleneck(c)} />
                </div>
                <h3 className="font-bold text-slate-800">{c.category} Issue <span className="text-slate-400 font-normal">in {c.zone} ({c.venue})</span></h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-2 flex items-center gap-1">
                  <User className="w-3 h-3" /> {c.requester?.full_name || 'Requester'} • {new Date(c.created_at).toLocaleDateString()}
                </p>
              </div>
              <button onClick={() => setViewItem({ type: 'complaint', data: c })} className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black uppercase tracking-wider rounded-xl transition w-full md:w-auto shrink-0">
                View Details
              </button>
            </div>
          ))}

          {/* 2. MATERIALS */}
          {(activeTab === 'all' || activeTab === 'materials') && filteredMaterials.map(m => (
            <div key={m.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:shadow-md transition">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <span className="font-black text-brand-maroon text-sm">Batch: {m.batch_id}</span>
                  <StatusPill bottleneck={getMaterialBottleneck(m)} />
                </div>
                <h3 className="font-bold text-slate-800">Requisition for {m.location} ({m.department})</h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-2 flex items-center gap-1">
                  <User className="w-3 h-3" /> {m.requester?.full_name || 'Requester'} • {m.items?.length || 0} Items Requested • {new Date(m.created_at).toLocaleDateString()}
                </p>
              </div>
              <button onClick={() => setViewItem({ type: 'material', data: m })} className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black uppercase tracking-wider rounded-xl transition w-full md:w-auto shrink-0">
                View Details
              </button>
            </div>
          ))}

          {/* 3. EVENTS */}
          {(activeTab === 'all' || activeTab === 'events') && filteredEvents.map(e => (
            <div key={e.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:shadow-md transition">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <span className="font-black text-brand-maroon text-sm">{e.event_title}</span>
                  <StatusPill bottleneck={getEventBottleneck(e)} />
                </div>
                <h3 className="font-bold text-slate-800">Venue: {e.location} <span className="text-slate-400 font-normal">({new Date(e.event_date).toLocaleDateString()} • {e.time_slot})</span></h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-2 flex items-center gap-1">
                  <User className="w-3 h-3" /> {e.requester?.full_name || 'Requester'} • Pax: {e.total_count}
                </p>
              </div>
              <button onClick={() => setViewItem({ type: 'event', data: e })} className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black uppercase tracking-wider rounded-xl transition w-full md:w-auto shrink-0">
                View Details
              </button>
            </div>
          ))}

          {/* 4. FLEET */}
          {(activeTab === 'all' || activeTab === 'fleet') && filteredFleet.map(f => (
            <div key={f.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:shadow-md transition">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <span className="font-black text-brand-maroon text-sm">{f.destination}</span>
                  <StatusPill bottleneck={getFleetBottleneck(f)} />
                </div>
                <h3 className="font-bold text-slate-800">Purpose: {f.purpose}</h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-2 flex items-center gap-1">
                  <User className="w-3 h-3" /> {f.requester?.full_name || 'Requester'} • Date: {new Date(f.created_at).toLocaleDateString()}
                </p>
              </div>
              <button onClick={() => setViewItem({ type: 'fleet', data: f })} className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black uppercase tracking-wider rounded-xl transition w-full md:w-auto shrink-0">
                View Details
              </button>
            </div>
          ))}

          {/* EMPTY STATE */}
          {filteredComplaints.length === 0 && filteredMaterials.length === 0 && filteredEvents.length === 0 && filteredFleet.length === 0 && (
            <div className="p-16 text-center bg-white rounded-3xl border border-slate-200">
              <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-bold uppercase tracking-wider text-xs">No matching records found.</p>
            </div>
          )}

        </div>
      )}

      {/* --- READ-ONLY DETAIL MODAL --- */}
      {viewItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-slate-900 p-5 flex justify-between items-center text-white shrink-0">
              <h3 className="font-extrabold text-sm uppercase tracking-widest">Institutional Record Overview</h3>
              <button onClick={() => setViewItem(null)} className="p-1 hover:bg-white/20 rounded-lg transition"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[70vh]">
              {viewItem.type === 'complaint' && (
                <div className="space-y-4">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <p className="text-xs font-bold text-slate-500 uppercase mb-1">Issue Description</p>
                    <p className="text-sm font-semibold text-slate-800">{viewItem.data.description}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                     <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                       <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Location Details</p>
                       <p className="text-sm font-black text-slate-800">{viewItem.data.zone} • {viewItem.data.venue}</p>
                     </div>
                     <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                       <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Requester Contact</p>
                       <p className="text-sm font-black text-slate-800">{viewItem.data.requester?.full_name}</p>
                     </div>
                  </div>
                </div>
              )}

              {viewItem.type === 'material' && (
                <div className="space-y-4">
                  <h4 className="text-xs font-black uppercase text-slate-400 tracking-widest border-b border-slate-100 pb-2">Batch Items</h4>
                  {viewItem.data.items?.map((i: any) => (
                    <div key={i.id} className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <span className="text-sm font-bold text-slate-800">{i.inventory?.name || i.custom_item_name}</span>
                      <span className="text-xs font-black text-brand-maroon">Qty: {i.requested_qty}</span>
                    </div>
                  ))}
                </div>
              )}

              {viewItem.type === 'event' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                       <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Location & Slot</p>
                       <p className="text-sm font-black text-slate-800">{viewItem.data.location} ({viewItem.data.time_slot})</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                       <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Expected Attendance</p>
                       <p className="text-sm font-black text-slate-800">{viewItem.data.total_count} Pax</p>
                    </div>
                  </div>
                </div>
              )}

              {viewItem.type === 'fleet' && (
                <div className="space-y-4">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <p className="text-xs font-bold text-slate-500 uppercase mb-1">Trip Details</p>
                    <p className="text-sm font-semibold text-slate-800">{viewItem.data.destination}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                     <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                       <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Passenger Count</p>
                       <p className="text-sm font-black text-slate-800">{viewItem.data.total_count} Pax</p>
                     </div>
                     <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                       <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Assigned Vehicles</p>
                       <p className="text-sm font-black text-slate-800">{viewItem.data.assigned_vehicles || 'None'}</p>
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