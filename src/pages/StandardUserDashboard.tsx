import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { CheckSquare, RefreshCw, MessageSquare, Package, Wrench, Calendar, Car, Clock, XCircle, AlertTriangle, X, CheckCircle } from "lucide-react";
import BatchDetailsModal from "../components/BatchDetailsModal";
import VisualPipelineStepper from "../components/VisualPipelineStepper";
import { useNavigate } from "react-router-dom";
import { useToast } from "../hooks/useToast";
import type { BaseEventData } from "../types/eventBooking";

export default function StandardUserDashboard() {
  const { showToast, toasts, removeToast } = useToast();
  const [activeTab, setActiveTab] = useState<'materials' | 'maintenance' | 'events' | 'fleet'>('materials');
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string>('REQUESTER');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const navigate = useNavigate();

  // Cancel Modal State
  const [cancelModalEvent, setCancelModalEvent] = useState<any | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');

  const [stats, setStats] = useState({ materialsActive: 0, complaintsActive: 0, eventsActive: 0, fleetActive: 0 });

  const [materials, setMaterials] = useState<any[]>([]);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [events, setEvents] = useState<BaseEventData[]>([]);
  const [fleet, setFleet] = useState<any[]>([]);

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
      let evQuery = supabase.from("events").select("*, requirements:event_requirements(*)").order("event_date", { ascending: true }).limit(30);
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
      if (evRes.data) setEvents(evRes.data as BaseEventData[]);
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

  useEffect(() => { fetchDashboardData(); }, []);

  const confirmReceipt = async (batch: any) => {
    setProcessingId(batch.id);
    try {
      const { error } = await supabase.rpc('receive_work_order', { target_id: batch.id });
      if (error) throw error;
      
      await supabase.from("system_logs").insert({
        action_type: "ITEMS_RECEIVED",
        description: `Batch ${batch.batch_id} marked as received. Request closed.`,
        user_email: currentUser?.email || "Requester",
      });

      showToast("Receipt confirmed! Request completed.", "success");
      fetchDashboardData();
    } catch (err: any) {
      showToast("Error confirming receipt: " + err.message, "error");
    } finally {
      setProcessingId(null);
    }
  };

  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelModalEvent || !currentUser) return;
    setProcessingId(cancelModalEvent.id);

    try {
      const { data, error } = await supabase.rpc('cancel_event_by_requester', {
        p_event_id: cancelModalEvent.id,
        p_user_id: currentUser.id,
        p_reason: cancelReason.trim() || 'Cancelled by requester'
      });

      if (error) throw error;
      if (data && data.success === false) throw new Error(data.message);

      showToast("Event cancelled and Tanzeem notified.", "success");
      setCancelModalEvent(null);
      setCancelReason('');
      fetchDashboardData();
    } catch (err: any) {
      showToast("Error cancelling event: " + err.message, "error");
    } finally {
      setProcessingId(null);
    }
  };

  const openChat = (batch: any) => {
    setActiveBatch(batch);
    setIsChatOpen(true);
  };

  const getDeliverySlaMessage = (req: any) => {
    if (req.pipeline_state !== 'PROCESSING' && req.pipeline_state !== 'ACTION_REQUIRED') return null;
    const headActionLog = req.logs?.slice().reverse().find((l: any) => l.message?.includes('processed') || l.message?.includes('split') || l.message?.includes('approved') || l.message?.includes('Stock'));
    const approvalTimestamp = headActionLog ? new Date(headActionLog.created_at) : (req.logs && req.logs.length > 0 ? new Date(req.logs[req.logs.length - 1].created_at) : new Date(req.created_at));
    if (approvalTimestamp.getHours() < 15) {
      return { type: 'same_day', text: 'You will get the requested material today.', badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
    } else {
      return { type: 'next_day', text: 'We will try to deliver your requested material today or tomorrow as earliest as possible.', badgeClass: 'bg-amber-50 text-amber-800 border-amber-200' };
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
            <h2 className="text-2xl md:text-3xl font-black text-brand-gold tracking-tight">My Dashboard</h2>
            {!isStandardUser && <span className="px-3 py-1 bg-brand-gold/20 text-brand-gold text-[9px] font-black uppercase tracking-widest rounded-lg border border-brand-gold/50 shadow-sm">{userRole.replace('_', ' ')}</span>}
          </div>
          <p className="text-sm text-slate-200 mt-2 font-medium">Track your materials, maintenance, and event requests in real-time.</p>
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

      {/* KPI Grid */}
      <div className={`grid grid-cols-2 ${isStandardUser ? 'md:grid-cols-3' : 'md:grid-cols-4'} gap-4`}>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 hover:border-slate-300 transition cursor-pointer" onClick={() => setActiveTab('materials')}>
          <div className="flex items-center justify-between text-[10px] text-slate-500 font-black uppercase tracking-widest"><span>Materials</span><Package className="w-4 h-4 text-slate-400" /></div>
          <div className="text-3xl font-black text-slate-800 mt-2">{stats.materialsActive}</div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 hover:border-amber-300 transition cursor-pointer" onClick={() => setActiveTab('maintenance')}>
          <div className="flex items-center justify-between text-[10px] text-amber-600 font-black uppercase tracking-widest"><span>Maintenance</span><Wrench className="w-4 h-4 text-amber-500" /></div>
          <div className="text-3xl font-black text-amber-600 mt-2">{stats.complaintsActive}</div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 hover:border-indigo-300 transition cursor-pointer" onClick={() => setActiveTab('events')}>
          <div className="flex items-center justify-between text-[10px] text-indigo-600 font-black uppercase tracking-widest"><span>Events</span><Calendar className="w-4 h-4 text-indigo-500" /></div>
          <div className="text-3xl font-black text-indigo-600 mt-2">{stats.eventsActive}</div>
        </div>
        {!isStandardUser && (
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 hover:border-emerald-300 transition cursor-pointer" onClick={() => setActiveTab('fleet')}>
            <div className="flex items-center justify-between text-[10px] text-emerald-600 font-black uppercase tracking-widest"><span>Fleet</span><Car className="w-4 h-4 text-emerald-500" /></div>
            <div className="text-3xl font-black text-emerald-600 mt-2">{stats.fleetActive}</div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-slate-200 overflow-x-auto pb-1">
        <button onClick={() => setActiveTab('materials')} className={`px-5 py-3 text-xs uppercase tracking-widest font-black border-b-2 transition whitespace-nowrap flex items-center gap-2 ${activeTab === 'materials' ? 'border-brand-maroon text-brand-maroon' : 'border-transparent text-slate-400 hover:text-slate-700'}`}><Package className="w-4 h-4" /> Materials</button>
        <button onClick={() => setActiveTab('maintenance')} className={`px-5 py-3 text-xs uppercase tracking-widest font-black border-b-2 transition whitespace-nowrap flex items-center gap-2 ${activeTab === 'maintenance' ? 'border-brand-maroon text-brand-maroon' : 'border-transparent text-slate-400 hover:text-slate-700'}`}><Wrench className="w-4 h-4" /> Maintenance</button>
        <button onClick={() => setActiveTab('events')} className={`px-5 py-3 text-xs uppercase tracking-widest font-black border-b-2 transition whitespace-nowrap flex items-center gap-2 ${activeTab === 'events' ? 'border-brand-maroon text-brand-maroon' : 'border-transparent text-slate-400 hover:text-slate-700'}`}><Calendar className="w-4 h-4" /> Events</button>
        {!isStandardUser && (
          <button onClick={() => setActiveTab('fleet')} className={`px-5 py-3 text-xs uppercase tracking-widest font-black border-b-2 transition whitespace-nowrap flex items-center gap-2 ${activeTab === 'fleet' ? 'border-brand-maroon text-brand-maroon' : 'border-transparent text-slate-400 hover:text-slate-700'}`}><Car className="w-4 h-4" /> Fleet</button>
        )}
      </div>

      {/* Content Area */}
      <div className="space-y-4">
        <div className="flex justify-between items-center px-1">
          <h3 className="font-black text-xs uppercase tracking-wider text-slate-500">Active {activeTab} Tickets</h3>
          <button onClick={fetchDashboardData} className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center space-x-1.5 hover:text-brand-maroon transition bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm"><RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} /><span>Sync</span></button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 font-bold animate-pulse bg-white rounded-3xl border border-slate-200">Loading {activeTab} records...</div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            
            {activeTab === 'materials' && (materials.length === 0 ? <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 text-slate-400 italic font-bold">No material requisitions found.</div> : materials.map((req) => { /* Render Materials */ 
              const logs = req.logs || [];
              const hasUnread = logs.length > 0 && logs[logs.length - 1].author_id !== currentUser?.id;
              const itemsSummary = (req.items || []).map((i: any) => `${i.inventory?.name || i.custom_item_name} (x${i.requested_qty})`).join(', ');
              const sla = getDeliverySlaMessage(req);
              return (
                <div key={req.id} className="bg-white rounded-3xl p-5 md:p-6 shadow-sm border border-slate-200 flex flex-col justify-between gap-4 transition hover:shadow-md">
                   <div>
                     <div className="flex justify-between items-start">
                       <div><span className="font-black text-brand-maroon text-base">{req.batch_id}</span><p className="text-xs font-bold text-slate-700 mt-0.5">{req.location}</p></div>
                       <div className="flex items-center gap-2">
                         {req.pipeline_state === "ACTION_REQUIRED" && <button onClick={() => confirmReceipt(req)} disabled={processingId === req.id} className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-wider rounded-xl text-[10px] flex items-center gap-1.5 shadow-sm transition disabled:opacity-50"><CheckSquare className="w-3.5 h-3.5" /> Confirm Receipt</button>}
                         <button onClick={() => openChat(req)} className="relative px-3 py-2 bg-slate-800 hover:bg-black text-white font-black uppercase tracking-wider rounded-xl text-[10px] flex items-center gap-1.5 shadow-sm transition">{hasUnread && <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-500 border-2 border-white"></span></span>}<MessageSquare className="w-3.5 h-3.5" /> Thread</button>
                       </div>
                     </div>
                     {sla && <div className={`mt-3 p-3 rounded-2xl border flex items-start gap-2.5 ${sla.badgeClass}`}><Clock className="w-4 h-4 shrink-0 mt-0.5" /><div className="text-xs font-bold leading-relaxed"><span className="font-black uppercase tracking-wider text-[10px] block mb-0.5">Estimated Fulfillment:</span>{sla.text}</div></div>}
                     {itemsSummary && <div className="mt-3 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-[11px] font-bold text-slate-600"><span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-0.5">Items:</span>{itemsSummary}</div>}
                   </div>
                   <VisualPipelineStepper type="REQUISITION" pipelineState={req.pipeline_state} />
                </div>
              );
            }))}

            {activeTab === 'maintenance' && (complaints.length === 0 ? <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 text-slate-400 italic font-bold">No maintenance complaints registered.</div> : complaints.map((c) => (
              <div key={c.id} className="bg-white rounded-3xl p-5 md:p-6 shadow-sm border border-slate-200 flex flex-col justify-between gap-4 transition hover:shadow-md">
                 <div>
                   <div className="flex justify-between items-start">
                     <div><span className="font-black text-brand-maroon text-base">{c.complaint_id}</span><h4 className="font-bold text-slate-800 text-sm mt-0.5">{c.category}</h4><p className="text-[11px] text-slate-500 font-medium">{c.zone} - {c.venue} ({c.room_area})</p></div>
                     <span className="text-[10px] font-bold text-slate-400 uppercase">{new Date(c.created_at).toLocaleDateString()}</span>
                   </div>
                   <p className="text-xs text-slate-600 font-medium mt-3 bg-slate-50 p-3 rounded-xl border border-slate-100 line-clamp-2">{c.description}</p>
                 </div>
                 <VisualPipelineStepper type="COMPLAINT" pipelineState={c.pipeline_state} />
              </div>
            )))}

            {/* UPGRADED EVENTS CARDS */}
            {activeTab === 'events' && (events.length === 0 ? <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 text-slate-400 italic font-bold">No event requests booked.</div> : events.map((e) => {
              const now = new Date();
              const [year, month, day] = e.event_date.split('-').map(Number);
              const eventDateObj = new Date(year, month - 1, day, 0, 0, 0);
              const todayObj = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
              const canCancel = eventDateObj.getTime() >= todayObj.getTime() && !['CLOSED', 'REJECTED'].includes(e.pipeline_state);
              
              const pendingReturns = e.requirements?.filter(r => r.return_status === 'PENDING_RETURN' || r.return_status === 'PARTIALLY_RETURNED') || [];
              const needsReturnReminder = e.pipeline_state === 'CLOSED' && pendingReturns.length > 0;

              return (
                <div key={e.id} className={`bg-white rounded-3xl p-5 md:p-6 shadow-sm border flex flex-col justify-between gap-4 transition hover:shadow-md ${e.pipeline_state === 'REJECTED' ? 'border-red-200' : 'border-slate-200'}`}>
                  <div>
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-black text-brand-maroon text-base">{e.event_title}</span>
                        <p className="text-xs font-bold text-slate-700 mt-0.5">{e.location} {e.sub_location ? `(${e.sub_location})` : ''}</p>
                      </div>
                      
                      <div className="flex flex-col items-end gap-2">
                        <div className="text-right">
                          <div className="font-bold text-slate-800 text-xs">{new Date(e.event_date).toLocaleDateString()}</div>
                          <div className="text-[9px] font-black text-brand-maroon uppercase mt-0.5">{e.time_slot}</div>
                        </div>
                        
                        {canCancel && (
                          <button 
                            onClick={() => { setCancelModalEvent(e); setCancelReason(''); }}
                            disabled={processingId === e.id}
                            className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-[10px] font-black uppercase tracking-wider rounded-xl flex items-center gap-1.5 transition shadow-sm disabled:opacity-50"
                          >
                            <XCircle className="w-3.5 h-3.5" /> Cancel Event
                          </button>
                        )}
                      </div>
                    </div>

                    {e.pipeline_state === 'REJECTED' && e.rejection_reason && (
                      <div className="mt-3 bg-red-50 p-3 rounded-xl border border-red-100">
                        <span className="text-[10px] font-black text-red-600 uppercase tracking-widest block mb-1">Reason / Status</span>
                        <p className="text-xs font-semibold text-red-900">{e.rejection_reason}</p>
                      </div>
                    )}

                    {e.requirements && e.requirements.length > 0 && (
                      <div className="mt-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <span className="text-[10px] font-black uppercase text-slate-400 mb-2 block tracking-widest">Processed Accessories</span>
                        <div className="flex flex-wrap gap-2">
                          {e.requirements.map((req, i) => {
                            const isRejected = req.status === 'Rejected';
                            const isApproved = req.status === 'Approved';
                            const displayQty = isApproved ? req.approved_qty : req.quantity;
                            
                            return (
                              <div key={i} className={`px-2.5 py-1.5 text-[10px] font-bold rounded-lg border flex flex-col ${isRejected ? 'bg-red-50 text-red-800 border-red-100 opacity-70' : isApproved ? 'bg-emerald-50 text-emerald-800 border-emerald-100' : 'bg-amber-50 text-amber-800 border-amber-100'}`}>
                                <span className={isRejected ? 'line-through' : ''}>
                                  {req.item_name} (x{displayQty})
                                </span>
                                {isApproved && (
                                  <span className="text-[9px] uppercase font-black opacity-80 tracking-widest mt-0.5">
                                    {req.is_returnable ? '🔄 Returnable' : '📦 Consumable'}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* RED RETURN REMINDER WARNING */}
                    {needsReturnReminder && (
                       <div className="mt-3 bg-brand-maroon/10 p-3 rounded-xl border border-brand-maroon/20 flex items-start gap-2.5 animate-pulse">
                         <AlertTriangle className="w-5 h-5 text-brand-maroon shrink-0 mt-0.5" />
                         <div className="text-xs font-bold text-brand-maroon">
                           <span className="uppercase tracking-widest text-[9px] font-black block mb-1">Action Required</span>
                           Event concluded. Please return loaned items to Tanzeem Operations:
                           <ul className="mt-1 list-disc list-inside opacity-80">
                             {pendingReturns.map(r => (
                               <li key={r.id}>{r.approved_qty - r.returned_qty}x {r.item_name}</li>
                             ))}
                           </ul>
                         </div>
                       </div>
                    )}
                  </div>

                  <VisualPipelineStepper type="EVENT" pipelineState={e.pipeline_state} eventDate={e.event_date} timeSlot={e.time_slot} />
                </div>
              );
            }))}

            {activeTab === 'fleet' && !isStandardUser && (fleet.length === 0 ? <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 text-slate-400 italic font-bold">No fleet requests booked.</div> : fleet.map((f) => (
              <div key={f.id} className="bg-white rounded-3xl p-5 md:p-6 shadow-sm border border-slate-200 flex flex-col justify-between gap-4 transition hover:shadow-md">
                 <div className="flex justify-between items-start">
                   <div><span className="font-black text-brand-maroon text-base">{f.destination}</span><p className="text-xs font-bold text-slate-700 mt-0.5">Purpose: {f.purpose}</p></div>
                   <div className="text-right"><div className="font-bold text-slate-800 text-xs">{new Date(f.request_date).toLocaleDateString()}</div><div className="text-[9px] font-black text-emerald-600 uppercase mt-0.5">Reach: {f.arrival_time}</div></div>
                 </div>
                 {f.assigned_vehicles && <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-100 flex items-center justify-between text-xs font-bold"><span className="text-indigo-900">Vehicle: {f.assigned_vehicles}</span><span className="text-indigo-600 uppercase text-[10px] font-black">Departure: {f.departure_time}</span></div>}
                 <VisualPipelineStepper type="FLEET" pipelineState={f.pipeline_state} />
              </div>
            )))}
          </div>
        )}
      </div>

      {/* Cancellation Reason Modal */}
      {cancelModalEvent && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl p-6 animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2 text-red-600"><AlertTriangle className="w-5 h-5" /><h3 className="text-base font-black uppercase tracking-tight">Cancel Event Booking</h3></div>
              <button onClick={() => setCancelModalEvent(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5"/></button>
            </div>
            <p className="text-xs text-slate-500 mb-4 font-medium">Cancelling <strong>"{cancelModalEvent.event_title}"</strong> on {new Date(cancelModalEvent.event_date).toLocaleDateString()} will release the venue and alert Tanzeem Operations.</p>
            <form onSubmit={handleCancelSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Reason for Cancellation</label>
                <textarea required rows={3} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="e.g. Guest speaker rescheduled, class cancelled..." className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-red-500" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setCancelModalEvent(null)} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition">Keep Event</button>
                <button type="submit" disabled={processingId === cancelModalEvent.id} className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition disabled:opacity-50">{processingId === cancelModalEvent.id ? 'Cancelling...' : 'Confirm Cancellation'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Fixed Toast Container */}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} onClick={() => removeToast(t.id)} className={`p-4 rounded-2xl shadow-2xl text-white text-sm font-bold flex items-center gap-3 pointer-events-auto cursor-pointer animate-in slide-in-from-bottom-5 duration-300 ${t.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'}`}>
            {t.type === 'error' ? <XCircle className="w-5 h-5"/> : <CheckCircle className="w-5 h-5"/>}
            {t.message}
          </div>
        ))}
      </div>

      {activeBatch && currentUser && <BatchDetailsModal batchId={activeBatch.batch_id} workOrderId={activeBatch.id} isOpen={isChatOpen} onClose={() => { setIsChatOpen(false); setActiveBatch(null); fetchDashboardData(); }} currentUser={currentUser} />}
    </div>
  );
}