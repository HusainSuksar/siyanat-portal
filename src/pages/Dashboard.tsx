import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { CheckSquare, RefreshCw, MessageSquare, Package, Wrench, Calendar, Car } from "lucide-react";
import BatchDetailsModal from "../components/BatchDetailsModal";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<'materials' | 'maintenance' | 'events' | 'fleet'>('materials');
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string>('STANDARD_USER');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const navigate = useNavigate();

  // Unified Stats
  const [stats, setStats] = useState({
    materialsActive: 0,
    complaintsActive: 0,
    eventsActive: 0,
    fleetActive: 0,
  });

  // Data States
  const [materials, setMaterials] = useState<any[]>([]);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [fleet, setFleet] = useState<any[]>([]);

  // Chat Modal State
  const [activeBatch, setActiveBatch] = useState<any>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);

  const fetchDashboardData = async () => {
    setLoading(true);
    const { data: authData } = await supabase.auth.getUser();

    if (authData.user) {
      setCurrentUser(authData.user);

      const { data: profile } = await supabase.from("profiles").select("role").eq("id", authData.user.id).single();
        
      const role = profile?.role || 'STANDARD_USER';
      setUserRole(role);
      const isGodMode = role === "ADMIN" || role === "GOD_MODE";

      // Build Queries
      let matQuery = supabase.from("work_orders").select("*, logs:work_order_logs(author_id)").order("created_at", { ascending: false }).limit(30);
      let compQuery = supabase.from("complaints").select("*").order("created_at", { ascending: false }).limit(30);
      let evQuery = supabase.from("events").select("*").order("event_date", { ascending: true }).limit(30);
      let fleetQuery = supabase.from("vehicle_requests").select("*").order("request_date", { ascending: true }).limit(30);

      // Restrict to personal history unless Admin
      if (!isGodMode) {
        matQuery = matQuery.eq("requester_id", authData.user.id);
        compQuery = compQuery.eq("requester_id", authData.user.id);
        evQuery = evQuery.eq("requester_id", authData.user.id);
        fleetQuery = fleetQuery.eq("requester_id", authData.user.id);
      }

      // Execute concurrently for speed
      const [matRes, compRes, evRes, fleetRes] = await Promise.all([matQuery, compQuery, evQuery, fleetQuery]);

      if (matRes.data) setMaterials(matRes.data);
      if (compRes.data) setComplaints(compRes.data);
      if (evRes.data) setEvents(evRes.data);
      if (fleetRes.data) setFleet(fleetRes.data);

      setStats({
        materialsActive: matRes.data?.filter((w) => w.dispatch_status !== "Received" && w.dispatch_status !== "Cancelled" && w.approval_status !== "Rejected").length || 0,
        complaintsActive: compRes.data?.filter((c) => !['Closed', 'Rejected', 'Verified'].includes(c.status)).length || 0,
        eventsActive: evRes.data?.filter((e) => e.status.includes("Pending")).length || 0,
        fleetActive: fleetRes.data?.filter((f) => f.status.includes("Pending")).length || 0,
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // --- MATERIAL ACTIONS ---
  const confirmReceipt = async (batch: any) => {
    if (!confirm("Confirm you have physically received these items? This will finalize the inventory deduction.")) return;
    setProcessingId(batch.id);

    try {
      const { data: items, error: itemsError } = await supabase.from("work_order_items").select("*, inventory:inventory_items(id, physical_stock, freezed_stock)").eq("work_order_id", batch.id).eq("status", "Available");
      if (itemsError) throw itemsError;

      if (items) {
        for (const item of items) {
          if (item.item_type === "Catalog" && item.inventory) {
            const newPhysical = Math.max(0, item.inventory.physical_stock - item.requested_qty);
            const newFreezed = Math.max(0, item.inventory.freezed_stock - item.requested_qty);
            await supabase.from("inventory_items").update({ physical_stock: newPhysical, freezed_stock: newFreezed }).eq("id", item.inventory.id);
          }
        }
      }

      await supabase.from("work_orders").update({ dispatch_status: "Received" }).eq("id", batch.id);
      await supabase.from("system_logs").insert({
        action_type: "ITEMS_RECEIVED",
        description: `Batch ${batch.batch_id} marked as received. Physical stock successfully deducted.`,
        user_email: currentUser?.email || "Requester",
      });

      alert("Receipt confirmed! Inventory finalized.");
      fetchDashboardData();
    } catch (err: any) {
      alert("Error confirming receipt: " + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const openChat = (batch: any) => {
    setActiveBatch(batch);
    setIsChatOpen(true);
  };

  const isStandardUser = userRole === 'STANDARD_USER';

  return (
    <div className="space-y-6 pb-24 max-w-6xl mx-auto">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-brand-maroon to-brand-dark rounded-3xl p-6 md:p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-gold opacity-5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl md:text-3xl font-black text-brand-gold tracking-tight">
              My Dashboard
            </h2>
            {!isStandardUser && (
              <span className="px-3 py-1 bg-brand-gold/20 text-brand-gold text-[9px] font-black uppercase tracking-widest rounded-lg border border-brand-gold/50 shadow-sm">
                {userRole.replace('_', ' ')}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-200 mt-2 font-medium">
            Track your materials, maintenance, and event requests in real-time.
          </p>
        </div>
        <div className="flex gap-3 relative z-10 w-full md:w-auto">
          <button onClick={() => navigate("/new-requisition")} className="flex-1 md:w-auto px-5 py-3.5 bg-brand-gold hover:bg-amber-500 text-brand-dark font-black text-xs uppercase tracking-widest rounded-xl shadow-lg transition flex justify-center items-center gap-1.5">
            <Package className="w-4 h-4" /> Material
          </button>
          <button onClick={() => navigate("/new-complaint")} className="flex-1 md:w-auto px-5 py-3.5 bg-slate-800 hover:bg-slate-900 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-lg transition flex justify-center items-center gap-1.5 border border-slate-700">
            <Wrench className="w-4 h-4" /> Issue
          </button>
        </div>
      </div>

      {/* Unified KPI Grid */}
      <div className={`grid grid-cols-2 ${isStandardUser ? 'md:grid-cols-3' : 'md:grid-cols-4'} gap-4`}>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 hover:border-slate-300 transition cursor-pointer" onClick={() => setActiveTab('materials')}>
          <div className="flex items-center justify-between text-[10px] text-slate-500 font-black uppercase tracking-widest">
            <span>Materials</span>
            <Package className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-3xl font-black text-slate-800 mt-2">{stats.materialsActive}</div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 hover:border-amber-300 transition cursor-pointer" onClick={() => setActiveTab('maintenance')}>
          <div className="flex items-center justify-between text-[10px] text-amber-600 font-black uppercase tracking-widest">
            <span>Maintenance</span>
            <Wrench className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-3xl font-black text-amber-600 mt-2">{stats.complaintsActive}</div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 hover:border-indigo-300 transition cursor-pointer" onClick={() => setActiveTab('events')}>
          <div className="flex items-center justify-between text-[10px] text-indigo-600 font-black uppercase tracking-widest">
            <span>Events</span>
            <Calendar className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-3xl font-black text-indigo-600 mt-2">{stats.eventsActive}</div>
        </div>

        {!isStandardUser && (
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 hover:border-emerald-300 transition cursor-pointer" onClick={() => setActiveTab('fleet')}>
            <div className="flex items-center justify-between text-[10px] text-emerald-600 font-black uppercase tracking-widest">
              <span>Fleet</span>
              <Car className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-3xl font-black text-emerald-600 mt-2">{stats.fleetActive}</div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-slate-200 overflow-x-auto pb-1">
        <button onClick={() => setActiveTab('materials')} className={`px-5 py-3 text-xs uppercase tracking-widest font-black border-b-2 transition whitespace-nowrap flex items-center gap-2 ${activeTab === 'materials' ? 'border-brand-maroon text-brand-maroon' : 'border-transparent text-slate-400 hover:text-slate-700'}`}>
          <Package className="w-4 h-4" /> Materials
        </button>
        <button onClick={() => setActiveTab('maintenance')} className={`px-5 py-3 text-xs uppercase tracking-widest font-black border-b-2 transition whitespace-nowrap flex items-center gap-2 ${activeTab === 'maintenance' ? 'border-brand-maroon text-brand-maroon' : 'border-transparent text-slate-400 hover:text-slate-700'}`}>
          <Wrench className="w-4 h-4" /> Maintenance
        </button>
        <button onClick={() => setActiveTab('events')} className={`px-5 py-3 text-xs uppercase tracking-widest font-black border-b-2 transition whitespace-nowrap flex items-center gap-2 ${activeTab === 'events' ? 'border-brand-maroon text-brand-maroon' : 'border-transparent text-slate-400 hover:text-slate-700'}`}>
          <Calendar className="w-4 h-4" /> Events
        </button>
        
        {!isStandardUser && (
          <button onClick={() => setActiveTab('fleet')} className={`px-5 py-3 text-xs uppercase tracking-widest font-black border-b-2 transition whitespace-nowrap flex items-center gap-2 ${activeTab === 'fleet' ? 'border-brand-maroon text-brand-maroon' : 'border-transparent text-slate-400 hover:text-slate-700'}`}>
            <Car className="w-4 h-4" /> Fleet
          </button>
        )}
      </div>

      {/* Tab Content Container */}
      <div className="bg-white rounded-3xl p-5 md:p-6 shadow-sm border border-slate-200 space-y-3">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-4 mb-4">
          <h3 className="font-black text-sm uppercase tracking-wide text-slate-800">
            {activeTab} Queue
          </h3>
          <button onClick={fetchDashboardData} className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center space-x-1.5 hover:text-brand-maroon transition bg-slate-50 hover:bg-brand-maroon/5 px-3 py-1.5 rounded-lg border border-slate-200">
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            <span>Sync</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            
            {/* --- MATERIALS TAB --- */}
            {activeTab === 'materials' && (
              <>
                <thead className="bg-slate-50 text-slate-500 uppercase font-black tracking-widest text-[9px]">
                  <tr>
                    <th className="p-4 rounded-tl-xl">Batch ID</th>
                    <th className="p-4">Location</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right rounded-tr-xl">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? <tr><td colSpan={4} className="p-8 text-center text-slate-400 font-bold animate-pulse">Loading...</td></tr> : materials.length === 0 ? <tr><td colSpan={4} className="p-8 text-center text-slate-400 font-bold italic">No material requests found.</td></tr> : materials.map((req) => {
                    const logs = req.logs || [];
                    const hasUnread = logs.length > 0 && logs[logs.length - 1].author_id !== currentUser?.id;
                    return (
                      <tr key={req.id} className="hover:bg-slate-50/80 transition">
                        <td className="p-4 font-black text-brand-maroon">{req.batch_id}</td>
                        <td className="p-4 font-bold text-slate-700">{req.location}</td>
                        <td className="p-4">
                          <div className="flex flex-col space-y-1.5 items-start">
                            <span className="px-2 py-1 rounded text-[9px] font-black uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">{req.approval_status}</span>
                            <span className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-wider shadow-sm border ${req.dispatch_status === 'Received' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : req.dispatch_status === 'Dispatched' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>{req.dispatch_status}</span>
                          </div>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {req.dispatch_status === "Dispatched" && (
                              <button onClick={() => confirmReceipt(req)} disabled={processingId === req.id} className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-wider rounded-lg text-[10px] flex items-center gap-1.5 shadow-sm transition disabled:opacity-50"><CheckSquare className="w-3.5 h-3.5" /><span className="hidden sm:inline">Receive</span></button>
                            )}
                            <button onClick={() => openChat(req)} className="relative px-3 py-2 bg-slate-800 hover:bg-black text-white font-black uppercase tracking-wider rounded-lg text-[10px] flex items-center gap-1.5 shadow-sm transition">
                              {hasUnread && <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-500 border-2 border-white"></span></span>}
                              <MessageSquare className="w-3.5 h-3.5" /><span className="hidden sm:inline">Thread</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </>
            )}

            {/* --- MAINTENANCE TAB (Strict Role Enforcement) --- */}
            {activeTab === 'maintenance' && (
              <>
                <thead className="bg-slate-50 text-slate-500 uppercase font-black tracking-widest text-[9px]">
                  <tr>
                    <th className="p-4 rounded-tl-xl">Complaint ID</th>
                    <th className="p-4">Location & Issue</th>
                    <th className="p-4 rounded-tr-xl text-right">Status Tracker</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? <tr><td colSpan={3} className="p-8 text-center text-slate-400 font-bold animate-pulse">Loading...</td></tr> : complaints.length === 0 ? <tr><td colSpan={3} className="p-8 text-center text-slate-400 font-bold italic">No complaints filed.</td></tr> : complaints.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-4">
                        <div className="font-black text-brand-maroon">{c.complaint_id}</div>
                        <div className="text-[10px] font-bold text-slate-400 mt-1">{new Date(c.created_at).toLocaleDateString()}</div>
                      </td>
                      <td className="p-4">
                        <div className="font-bold text-slate-800 mb-0.5">{c.category}</div>
                        <div className="text-[10px] font-medium text-slate-500">{c.zone} - {c.venue} ({c.room_area})</div>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex flex-col items-end gap-1.5">
                          <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border shadow-sm ${c.status === 'Verified' || c.status === 'Closed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : c.status === 'Rejected' || c.status === 'Not Processed' ? 'bg-red-50 text-red-700 border-red-200' : c.status === 'Completed' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                            {c.status}
                          </span>
                          {/* User Note indicating Supervisor Authority */}
                          {c.status === 'Completed' && (
                            <span className="text-[9px] text-slate-400 font-bold mt-1 max-w-[150px]">
                              Awaiting Supervisor verification.
                            </span>
                          )}
                          {c.rejection_reason && <div className="text-[9px] font-bold text-red-600 mt-1 max-w-[150px] truncate" title={c.rejection_reason}>Reason: {c.rejection_reason}</div>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </>
            )}

            {/* --- EVENTS TAB --- */}
            {activeTab === 'events' && (
              <>
                <thead className="bg-slate-50 text-slate-500 uppercase font-black tracking-widest text-[9px]">
                  <tr>
                    <th className="p-4 rounded-tl-xl">Event Title</th>
                    <th className="p-4">Schedule</th>
                    <th className="p-4">Location</th>
                    <th className="p-4 text-right rounded-tr-xl">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? <tr><td colSpan={4} className="p-8 text-center text-slate-400 font-bold animate-pulse">Loading...</td></tr> : events.length === 0 ? <tr><td colSpan={4} className="p-8 text-center text-slate-400 font-bold italic">No events booked.</td></tr> : events.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-4 font-bold text-brand-maroon">{e.event_title}</td>
                      <td className="p-4">
                        <div className="font-bold text-slate-700">{new Date(e.event_date).toLocaleDateString()}</div>
                        <div className="text-[9px] font-black text-slate-400 uppercase mt-0.5">{e.time_slot}</div>
                      </td>
                      <td className="p-4 font-medium text-slate-600">{e.location} {e.sub_location && <span className="block text-[10px] text-slate-400">({e.sub_location})</span>}</td>
                      <td className="p-4 text-right">
                        <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border shadow-sm ${e.status === 'Approved & Scheduled' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : e.status === 'Not Confirmed' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>{e.status}</span>
                        {e.rejection_reason && <div className="text-[9px] font-bold text-red-600 mt-1.5 text-right max-w-[150px] ml-auto truncate" title={e.rejection_reason}>Reason: {e.rejection_reason}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </>
            )}

            {/* --- FLEET TAB --- */}
            {activeTab === 'fleet' && !isStandardUser && (
              <>
                <thead className="bg-slate-50 text-slate-500 uppercase font-black tracking-widest text-[9px]">
                  <tr>
                    <th className="p-4 rounded-tl-xl">Destination / Purpose</th>
                    <th className="p-4">Date & Times</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right rounded-tr-xl">Dispatch Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? <tr><td colSpan={4} className="p-8 text-center text-slate-400 font-bold animate-pulse">Loading...</td></tr> : fleet.length === 0 ? <tr><td colSpan={4} className="p-8 text-center text-slate-400 font-bold italic">No fleet requests.</td></tr> : fleet.map((f) => (
                    <tr key={f.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-4">
                        <div className="font-black text-brand-maroon tracking-wide">{f.destination}</div>
                        <div className="text-[10px] font-bold text-slate-500 mt-1">{f.purpose}</div>
                      </td>
                      <td className="p-4">
                        <div className="font-bold text-slate-700">{new Date(f.request_date).toLocaleDateString()}</div>
                        <div className="text-[10px] font-black text-emerald-600 uppercase mt-0.5">Reach By: {f.arrival_time}</div>
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border shadow-sm ${f.status === 'Fleet Dispatched' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : f.status === 'Not Serviced' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>{f.status}</span>
                        {f.rejection_reason && <div className="text-[9px] font-bold text-red-600 mt-1.5 max-w-[150px] truncate" title={f.rejection_reason}>Reason: {f.rejection_reason}</div>}
                      </td>
                      <td className="p-4 text-right">
                        {f.assigned_vehicles ? (
                          <div className="bg-indigo-50 p-2 rounded-lg border border-indigo-100 inline-block text-left">
                            <div className="font-bold text-slate-800 text-[10px]">{f.assigned_vehicles}</div>
                            <div className="text-indigo-600 font-black uppercase text-[9px] mt-0.5 tracking-wider">Depart @ {f.departure_time}</div>
                          </div>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-400 italic">Pending Assignment</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </>
            )}

          </table>
        </div>
      </div>

      {/* Slide-out Chat Modal for Materials */}
      {activeBatch && currentUser && (
        <BatchDetailsModal
          batchId={activeBatch.batch_id}
          workOrderId={activeBatch.id}
          isOpen={isChatOpen}
          onClose={() => {
            setIsChatOpen(false);
            setActiveBatch(null);
            fetchDashboardData();
          }}
          currentUser={currentUser}
        />
      )}
    </div>
  );
}