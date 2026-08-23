import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { CheckSquare, RefreshCw, MessageSquare, Package, Wrench, Calendar, Car, Clock } from "lucide-react";
import BatchDetailsModal from "../components/BatchDetailsModal";
import VisualPipelineStepper from "../components/VisualPipelineStepper";
import { useNavigate } from "react-router-dom";

export default function StandardUserDashboard() {
  const [activeTab, setActiveTab] = useState<'materials' | 'maintenance' | 'events' | 'fleet'>('materials');
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string>('REQUESTER');
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
        
      const role = profile?.role || 'REQUESTER';
      setUserRole(role);
      const isGodMode = role === "SUPER_ADMIN" || role === "ADMIN";

      let matQuery = supabase.from("work_orders").select("*, logs:work_order_logs(author_id, created_at, message), items:work_order_items(custom_item_name, requested_qty, inventory:inventory_items(name))").order("created_at", { ascending: false }).limit(30);
      let compQuery = supabase.from("complaints").select("*").order("created_at", { ascending: false }).limit(30);
      let evQuery = supabase.from("events").select("*").order("event_date", { ascending: true }).limit(30);
      let fleetQuery = supabase.from("vehicle_requests").select("*").order("request_date", { ascending: true }).limit(30);

      if (!isGodMode) {
        matQuery = matQuery.eq("requester_id", authData.user.id);
        compQuery = compQuery.eq("requester_id", authData.user.id);
        evQuery = evQuery.eq("requester_id", authData.user.id);
        fleetQuery = fleetQuery.eq("requester_id", authData.user.id);
      }

      const [matRes, compRes, evRes, fleetRes] = await Promise.all([matQuery, compQuery, evQuery, fleetQuery]);

      if (matRes.data) setMaterials(matRes.data);
      if (compRes.data) setComplaints(compRes.data);
      if (evRes.data) setEvents(evRes.data);
      if (fleetRes.data) setFleet(fleetRes.data);

      setStats({
        materialsActive: matRes.data?.filter((w) => !['CLOSED', 'REJECTED'].includes(w.pipeline_state)).length || 0,
        complaintsActive: compRes.data?.filter((c) => !['CLOSED', 'REJECTED'].includes(c.pipeline_state)).length || 0,
        eventsActive: evRes.data?.filter((e) => !['CLOSED', 'REJECTED'].includes(e.pipeline_state)).length || 0,
        fleetActive: fleetRes.data?.filter((f) => !['CLOSED', 'REJECTED'].includes(f.pipeline_state)).length || 0,
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const confirmReceipt = async (batch: any) => {
    if (!confirm("Confirm you have physically received these items? This will finalize the inventory deduction and close the request.")) return;
    setProcessingId(batch.id);

    try {
      const { error } = await supabase.rpc('receive_work_order', { target_id: batch.id });
      if (error) throw error;
      
      await supabase.from("system_logs").insert({
        action_type: "ITEMS_RECEIVED",
        description: `Batch ${batch.batch_id} marked as received. Request closed.`,
        user_email: currentUser?.email || "Requester",
      });

      alert("Receipt confirmed! Request completed.");
      fetchDashboardData();
    } catch (err: any) {
      console.error(err);
      alert("Error confirming receipt: " + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const openChat = (batch: any) => {
    setActiveBatch(batch);
    setIsChatOpen(true);
  };

  // Dynamic 3:00 PM SLA Delivery Message Calculation
  const getDeliverySlaMessage = (req: any) => {
    if (['REJECTED', 'CLOSED'].includes(req.pipeline_state)) return null;

    // Use latest system update timestamp or creation date
    const approvalTimestamp = req.logs && req.logs.length > 0 
      ? new Date(req.logs[req.logs.length - 1].created_at) 
      : new Date(req.created_at);

    const approvalHour = approvalTimestamp.getHours();

    if (approvalHour < 15) {
      return {
        type: 'same_day',
        text: 'You will get the requested material today.',
        badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200'
      };
    } else {
      return {
        type: 'next_day',
        text: 'We will try to deliver your requested material today or tomorrow as earliest as possible.',
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-200'
      };
    }
  };

  const isStandardUser = userRole === 'REQUESTER';

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

      {/* Main Content Area */}
      <div className="space-y-4">
        <div className="flex justify-between items-center px-1">
          <h3 className="font-black text-xs uppercase tracking-wider text-slate-500">
            Active {activeTab} Tickets ({activeTab === 'materials' ? materials.length : activeTab === 'maintenance' ? complaints.length : activeTab === 'events' ? events.length : fleet.length})
          </h3>
          <button onClick={fetchDashboardData} className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center space-x-1.5 hover:text-brand-maroon transition bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            <span>Sync</span>
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 font-bold animate-pulse bg-white rounded-3xl border border-slate-200">
            Loading {activeTab} records...
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            
            {/* --- MATERIALS CARDS --- */}
            {activeTab === 'materials' && (
              materials.length === 0 ? (
                <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 text-slate-400 italic font-bold">No material requisitions found.</div>
              ) : (
                materials.map((req) => {
                  const logs = req.logs || [];
                  const hasUnread = logs.length > 0 && logs[logs.length - 1].author_id !== currentUser?.id;
                  const itemsSummary = (req.items || []).map((i: any) => `${i.inventory?.name || i.custom_item_name} (x${i.requested_qty})`).join(', ');
                  const sla = getDeliverySlaMessage(req);

                  return (
                    <div key={req.id} className="bg-white rounded-3xl p-5 md:p-6 shadow-sm border border-slate-200 flex flex-col justify-between gap-4 transition hover:shadow-md">
                      <div>
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-black text-brand-maroon text-base">{req.batch_id}</span>
                            <p className="text-xs font-bold text-slate-700 mt-0.5">{req.location}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {req.pipeline_state === "ACTION_REQUIRED" && (
                              <button onClick={() => confirmReceipt(req)} disabled={processingId === req.id} className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-wider rounded-xl text-[10px] flex items-center gap-1.5 shadow-sm transition disabled:opacity-50">
                                <CheckSquare className="w-3.5 h-3.5" /> Confirm Receipt
                              </button>
                            )}
                            <button onClick={() => openChat(req)} className="relative px-3 py-2 bg-slate-800 hover:bg-black text-white font-black uppercase tracking-wider rounded-xl text-[10px] flex items-center gap-1.5 shadow-sm transition">
                              {hasUnread && <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-500 border-2 border-white"></span></span>}
                              <MessageSquare className="w-3.5 h-3.5" /> Thread
                            </button>
                          </div>
                        </div>

                        {/* 3:00 PM SLA Notification Badge */}
                        {sla && (
                          <div className={`mt-3 p-3 rounded-2xl border flex items-start gap-2.5 ${sla.badgeClass}`}>
                            <Clock className="w-4 h-4 shrink-0 mt-0.5" />
                            <div className="text-xs font-bold leading-relaxed">
                              <span className="font-black uppercase tracking-wider text-[10px] block mb-0.5">Estimated Fulfillment:</span>
                              {sla.text}
                            </div>
                          </div>
                        )}

                        {itemsSummary && (
                          <div className="mt-3 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-[11px] font-bold text-slate-600">
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-0.5">Items:</span>
                            {itemsSummary}
                          </div>
                        )}
                      </div>

                      <VisualPipelineStepper type="REQUISITION" pipelineState={req.pipeline_state} />
                    </div>
                  );
                })
              )
            )}

            {/* --- MAINTENANCE CARDS --- */}
            {activeTab === 'maintenance' && (
              complaints.length === 0 ? (
                <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 text-slate-400 italic font-bold">No maintenance complaints registered.</div>
              ) : (
                complaints.map((c) => (
                  <div key={c.id} className="bg-white rounded-3xl p-5 md:p-6 shadow-sm border border-slate-200 flex flex-col justify-between gap-4 transition hover:shadow-md">
                    <div>
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="font-black text-brand-maroon text-base">{c.complaint_id}</span>
                          <h4 className="font-bold text-slate-800 text-sm mt-0.5">{c.category}</h4>
                          <p className="text-[11px] text-slate-500 font-medium">{c.zone} - {c.venue} ({c.room_area})</p>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">
                          {new Date(c.created_at).toLocaleDateString()}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 font-medium mt-3 bg-slate-50 p-3 rounded-xl border border-slate-100 line-clamp-2">
                        {c.description}
                      </p>
                    </div>

                    <VisualPipelineStepper type="COMPLAINT" pipelineState={c.pipeline_state} />
                  </div>
                ))
              )
            )}

            {/* --- EVENTS CARDS --- */}
            {activeTab === 'events' && (
              events.length === 0 ? (
                <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 text-slate-400 italic font-bold">No event requests booked.</div>
              ) : (
                events.map((e) => (
                  <div key={e.id} className="bg-white rounded-3xl p-5 md:p-6 shadow-sm border border-slate-200 flex flex-col justify-between gap-4 transition hover:shadow-md">
                    <div>
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="font-black text-brand-maroon text-base">{e.event_title}</span>
                          <p className="text-xs font-bold text-slate-700 mt-0.5">{e.location} {e.sub_location ? `(${e.sub_location})` : ''}</p>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-slate-800 text-xs">{new Date(e.event_date).toLocaleDateString()}</div>
                          <div className="text-[9px] font-black text-brand-maroon uppercase mt-0.5">{e.time_slot}</div>
                        </div>
                      </div>
                    </div>

                    <VisualPipelineStepper type="EVENT" pipelineState={e.pipeline_state} />
                  </div>
                ))
              )
            )}

            {/* --- FLEET CARDS --- */}
            {activeTab === 'fleet' && !isStandardUser && (
              fleet.length === 0 ? (
                <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 text-slate-400 italic font-bold">No fleet requests booked.</div>
              ) : (
                fleet.map((f) => (
                  <div key={f.id} className="bg-white rounded-3xl p-5 md:p-6 shadow-sm border border-slate-200 flex flex-col justify-between gap-4 transition hover:shadow-md">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-black text-brand-maroon text-base">{f.destination}</span>
                        <p className="text-xs font-bold text-slate-700 mt-0.5">Purpose: {f.purpose}</p>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-slate-800 text-xs">{new Date(f.request_date).toLocaleDateString()}</div>
                        <div className="text-[9px] font-black text-emerald-600 uppercase mt-0.5">Reach: {f.arrival_time}</div>
                      </div>
                    </div>

                    {f.assigned_vehicles && (
                      <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-100 flex items-center justify-between text-xs font-bold">
                        <span className="text-indigo-900">Vehicle: {f.assigned_vehicles}</span>
                        <span className="text-indigo-600 uppercase text-[10px] font-black">Departure: {f.departure_time}</span>
                      </div>
                    )}

                    <VisualPipelineStepper type="FLEET" pipelineState={f.pipeline_state} />
                  </div>
                ))
              )
            )}

          </div>
        )}
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