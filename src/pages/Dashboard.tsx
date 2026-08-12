import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  CheckSquare,
  RefreshCw,
  MessageSquare,
  Package,
  Wrench,
  Calendar,
  Car,
  CheckCircle,
  AlertCircle} from "lucide-react";
import BatchDetailsModal from "../components/BatchDetailsModal";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<'materials' | 'maintenance' | 'events' | 'fleet'>('materials');
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
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

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", authData.user.id)
        .single();
        
      const isAdmin = profile?.role === "ADMIN";

      // Build Queries
      let matQuery = supabase.from("work_orders").select("*, logs:work_order_logs(author_id)").order("created_at", { ascending: false }).limit(30);
      let compQuery = supabase.from("complaints").select("*").order("created_at", { ascending: false }).limit(30);
      let evQuery = supabase.from("events").select("*").order("event_date", { ascending: true }).limit(30);
      let fleetQuery = supabase.from("vehicle_requests").select("*").order("request_date", { ascending: true }).limit(30);

      // Requesters only see their own history. Admins see the global feed.
      if (!isAdmin) {
        matQuery = matQuery.eq("requester_id", authData.user.id);
        compQuery = compQuery.eq("requester_id", authData.user.id);
        evQuery = evQuery.eq("requester_id", authData.user.id);
        fleetQuery = fleetQuery.eq("requester_id", authData.user.id);
      }

      // Execute concurrently for speed
      const [matRes, compRes, evRes, fleetRes] = await Promise.all([
        matQuery, compQuery, evQuery, fleetQuery
      ]);

      if (matRes.data) setMaterials(matRes.data);
      if (compRes.data) setComplaints(compRes.data);
      if (evRes.data) setEvents(evRes.data);
      if (fleetRes.data) setFleet(fleetRes.data);

      // Calculate Active/Pending Stats to draw user attention
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
      const { data: items, error: itemsError } = await supabase
        .from("work_order_items")
        .select("*, inventory:inventory_items(id, physical_stock, freezed_stock)")
        .eq("work_order_id", batch.id)
        .eq("status", "Available");

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

  // --- MAINTENANCE ACTIONS ---
  const verifyComplaint = async (id: string) => {
    if (!confirm('Are you satisfied with the work? This will mark the complaint as Verified and close your ticket.')) return;
    setProcessingId(id);
    await supabase.from('complaints').update({ status: 'Verified' }).eq('id', id);
    
    await supabase.from('system_logs').insert({
      action_type: 'COMPLAINT_VERIFIED',
      description: `Requester verified that the maintenance work was completed satisfactorily.`,
      user_email: currentUser?.email || "Requester"
    });

    fetchDashboardData();
    setProcessingId(null);
  };

  const reopenComplaint = async (id: string) => {
    const reason = prompt('Please enter the reason for reopening this complaint (e.g., Issue still persists):');
    if (!reason) return alert('A reason is mandatory to reopen a complaint.');
    setProcessingId(id);
    
    await supabase.from('complaints').update({ status: 'Complaint Reopened' }).eq('id', id);
    
    await supabase.from('system_logs').insert({
      action_type: 'COMPLAINT_REOPENED',
      description: `Requester reopened complaint. Reason: ${reason}`,
      user_email: currentUser?.email || "Requester"
    });

    fetchDashboardData();
    setProcessingId(null);
  };

  return (
    <div className="space-y-6 pb-24">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-brand-maroon to-brand-dark rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-brand-gold">
            My Request Dashboard
          </h2>
          <p className="text-xs text-slate-200 mt-1">
            Track your materials, maintenance, events, and fleet requests in one place.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate("/new-requisition")} className="px-4 py-2 bg-brand-gold hover:bg-amber-500 text-brand-dark font-black text-[11px] uppercase tracking-wider rounded-xl shadow-lg transition">
            + Material
          </button>
          <button onClick={() => navigate("/new-complaint")} className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-black text-[11px] uppercase tracking-wider rounded-xl shadow-lg transition">
            + Complaint
          </button>
        </div>
      </div>

      {/* Unified KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold uppercase">
            <span>Active Materials</span>
            <Package className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-extrabold text-slate-800 mt-1">{stats.materialsActive}</div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between text-[10px] text-amber-600 font-bold uppercase">
            <span>Open Complaints</span>
            <Wrench className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-extrabold text-amber-600 mt-1">{stats.complaintsActive}</div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between text-[10px] text-indigo-600 font-bold uppercase">
            <span>Pending Events</span>
            <Calendar className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-extrabold text-indigo-600 mt-1">{stats.eventsActive}</div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between text-[10px] text-emerald-600 font-bold uppercase">
            <span>Pending Fleet</span>
            <Car className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-600 mt-1">{stats.fleetActive}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-slate-200 overflow-x-auto pb-1">
        <button onClick={() => setActiveTab('materials')} className={`px-4 py-2 text-sm font-bold border-b-2 transition whitespace-nowrap flex items-center gap-2 ${activeTab === 'materials' ? 'border-brand-maroon text-brand-maroon' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          <Package className="w-4 h-4" /> Materials
        </button>
        <button onClick={() => setActiveTab('maintenance')} className={`px-4 py-2 text-sm font-bold border-b-2 transition whitespace-nowrap flex items-center gap-2 ${activeTab === 'maintenance' ? 'border-brand-maroon text-brand-maroon' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          <Wrench className="w-4 h-4" /> Maintenance
        </button>
        <button onClick={() => setActiveTab('events')} className={`px-4 py-2 text-sm font-bold border-b-2 transition whitespace-nowrap flex items-center gap-2 ${activeTab === 'events' ? 'border-brand-maroon text-brand-maroon' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          <Calendar className="w-4 h-4" /> Events
        </button>
        <button onClick={() => setActiveTab('fleet')} className={`px-4 py-2 text-sm font-bold border-b-2 transition whitespace-nowrap flex items-center gap-2 ${activeTab === 'fleet' ? 'border-brand-maroon text-brand-maroon' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          <Car className="w-4 h-4" /> Fleet
        </button>
      </div>

      {/* Tab Content Container */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 space-y-3">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b pb-3">
          <h3 className="font-extrabold text-sm uppercase text-slate-800">
            {activeTab} Tracking
          </h3>
          <button onClick={fetchDashboardData} className="text-[11px] text-brand-maroon font-bold flex items-center space-x-1 hover:text-brand-dark transition">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh View</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            
            {/* --- MATERIALS TAB --- */}
            {activeTab === 'materials' && (
              <>
                <thead className="bg-slate-100 text-slate-700 uppercase font-bold">
                  <tr>
                    <th className="p-3">Batch ID</th>
                    <th className="p-3">Location</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {loading ? <tr><td colSpan={4} className="p-4 text-center">Loading...</td></tr> : materials.length === 0 ? <tr><td colSpan={4} className="p-4 text-center text-slate-500">No material requests found.</td></tr> : materials.map((req) => {
                    const logs = req.logs || [];
                    const hasUnread = logs.length > 0 && logs[logs.length - 1].author_id !== currentUser?.id;
                    return (
                      <tr key={req.id} className="hover:bg-slate-50">
                        <td className="p-3 font-bold text-brand-maroon">{req.batch_id}</td>
                        <td className="p-3 font-semibold">{req.location}</td>
                        <td className="p-3">
                          <div className="flex flex-col space-y-1 items-start">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">{req.approval_status}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${req.dispatch_status === 'Received' ? 'bg-emerald-100 text-emerald-800' : req.dispatch_status === 'Dispatched' ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-700'}`}>{req.dispatch_status}</span>
                          </div>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {req.dispatch_status === "Dispatched" && (
                              <button onClick={() => confirmReceipt(req)} disabled={processingId === req.id} className="px-2.5 py-1.5 bg-emerald-600 text-white font-bold rounded-lg text-[11px] flex items-center gap-1 disabled:opacity-50"><CheckSquare className="w-3 h-3" /><span className="hidden sm:inline">Receive</span></button>
                            )}
                            <button onClick={() => openChat(req)} className="relative px-2.5 py-1.5 bg-slate-800 text-white font-bold rounded-lg text-[11px] flex items-center gap-1">
                              {hasUnread && <span className="absolute -top-1 -right-1 flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-white"></span></span>}
                              <MessageSquare className="w-3 h-3" /><span className="hidden sm:inline">Thread</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </>
            )}

            {/* --- MAINTENANCE TAB --- */}
            {activeTab === 'maintenance' && (
              <>
                <thead className="bg-slate-100 text-slate-700 uppercase font-bold">
                  <tr>
                    <th className="p-3">Complaint ID</th>
                    <th className="p-3">Location & Issue</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Verification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {loading ? <tr><td colSpan={4} className="p-4 text-center">Loading...</td></tr> : complaints.length === 0 ? <tr><td colSpan={4} className="p-4 text-center text-slate-500">No complaints filed.</td></tr> : complaints.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-brand-maroon">{c.complaint_id}<div className="text-[10px] text-slate-500 mt-1">{new Date(c.created_at).toLocaleDateString()}</div></td>
                      <td className="p-3">
                        <div className="font-semibold text-slate-800">{c.category}</div>
                        <div className="text-[10px] text-slate-600">{c.zone} - {c.venue} ({c.room_area})</div>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${c.status === 'Verified' || c.status === 'Closed' ? 'bg-emerald-100 text-emerald-800' : c.status === 'Rejected' || c.status === 'Not Processed' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>{c.status}</span>
                        {c.rejection_reason && <div className="text-[9px] text-red-600 mt-1 max-w-[150px] truncate" title={c.rejection_reason}>Reason: {c.rejection_reason}</div>}
                      </td>
                      <td className="p-3 text-right">
                        {c.status === 'Completed' && (
                          <div className="flex items-center justify-end gap-1.5">
                            <button onClick={() => verifyComplaint(c.id)} disabled={processingId === c.id} className="px-2 py-1.5 bg-emerald-600 text-white font-bold rounded text-[10px] flex items-center gap-1 disabled:opacity-50"><CheckCircle className="w-3 h-3"/> Verify</button>
                            <button onClick={() => reopenComplaint(c.id)} disabled={processingId === c.id} className="px-2 py-1.5 bg-red-600 text-white font-bold rounded text-[10px] flex items-center gap-1 disabled:opacity-50"><AlertCircle className="w-3 h-3"/> Reopen</button>
                          </div>
                        )}
                        {['Verified', 'Closed'].includes(c.status) && (
                          <span className="text-[10px] text-emerald-600 font-bold flex items-center justify-end gap-1"><CheckCircle className="w-3 h-3"/> Resolved</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </>
            )}

            {/* --- EVENTS TAB --- */}
            {activeTab === 'events' && (
              <>
                <thead className="bg-slate-100 text-slate-700 uppercase font-bold">
                  <tr>
                    <th className="p-3">Event Title</th>
                    <th className="p-3">Schedule</th>
                    <th className="p-3">Location</th>
                    <th className="p-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {loading ? <tr><td colSpan={4} className="p-4 text-center">Loading...</td></tr> : events.length === 0 ? <tr><td colSpan={4} className="p-4 text-center text-slate-500">No events booked.</td></tr> : events.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-brand-maroon">{e.event_title}</td>
                      <td className="p-3 font-semibold text-slate-700">
                        {new Date(e.event_date).toLocaleDateString()}
                        <div className="text-[10px] text-slate-500 font-normal">{e.time_slot}</div>
                      </td>
                      <td className="p-3 text-slate-600">{e.location} {e.sub_location && `(${e.sub_location})`}</td>
                      <td className="p-3 text-right">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${e.status === 'Approved & Scheduled' ? 'bg-emerald-100 text-emerald-800' : e.status === 'Not Confirmed' ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-700'}`}>{e.status}</span>
                        {e.rejection_reason && <div className="text-[9px] text-red-600 mt-1 text-right max-w-[150px] ml-auto truncate" title={e.rejection_reason}>Reason: {e.rejection_reason}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </>
            )}

            {/* --- FLEET TAB --- */}
            {activeTab === 'fleet' && (
              <>
                <thead className="bg-slate-100 text-slate-700 uppercase font-bold">
                  <tr>
                    <th className="p-3">Destination / Purpose</th>
                    <th className="p-3">Date & Times</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Dispatch Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {loading ? <tr><td colSpan={4} className="p-4 text-center">Loading...</td></tr> : fleet.length === 0 ? <tr><td colSpan={4} className="p-4 text-center text-slate-500">No fleet requests.</td></tr> : fleet.map((f) => (
                    <tr key={f.id} className="hover:bg-slate-50">
                      <td className="p-3">
                        <div className="font-bold text-brand-maroon">{f.destination}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{f.purpose}</div>
                      </td>
                      <td className="p-3 font-semibold text-slate-700">
                        {new Date(f.request_date).toLocaleDateString()}
                        <div className="text-[10px] text-emerald-600 font-bold">Reach By: {f.arrival_time}</div>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${f.status === 'Fleet Dispatched' ? 'bg-indigo-100 text-indigo-800' : f.status === 'Not Serviced' ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-700'}`}>{f.status}</span>
                        {f.rejection_reason && <div className="text-[9px] text-red-600 mt-1 max-w-[150px] truncate" title={f.rejection_reason}>Reason: {f.rejection_reason}</div>}
                      </td>
                      <td className="p-3 text-right">
                        {f.assigned_vehicles ? (
                          <div className="text-[10px]">
                            <div className="font-bold text-slate-800">{f.assigned_vehicles}</div>
                            <div className="text-indigo-600 font-black uppercase mt-0.5">Depart @ {f.departure_time}</div>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">Pending Assignment</span>
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