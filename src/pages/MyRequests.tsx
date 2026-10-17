import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { 
  CheckSquare, RefreshCw, MessageSquare, Package, Wrench, 
  Calendar, Car, Clock, XCircle, AlertTriangle, X, CheckCircle,
  Ban, Image as ImageIcon, FileText
} from "lucide-react";
import BatchDetailsModal from "../components/BatchDetailsModal";
import VisualPipelineStepper from "../components/VisualPipelineStepper";
import { useNavigate } from "react-router-dom";
import { useToast } from "../hooks/useToast";
import type { BaseEventData } from "../types/eventBooking";
import type { WorkOrder } from "../types";

interface WorkOrderLog {
  author_id?: string;
  message?: string;
  created_at: string;
}

interface ReqItem {
  id?: string;
  inventory?: { name?: string };
  custom_item_name?: string | null;
  status?: string;
  requested_qty?: number;
}

interface MaterialReq {
  id: string;
  batch_id: string;
  location?: string;
  pipeline_state: string;
  logs?: WorkOrderLog[];
  items?: ReqItem[];
  created_at?: string;
}

interface ComplaintPhoto {
  file_url: string;
}

interface ComplaintRecord {
  id: string;
  complaint_id: string;
  category: string;
  zone: string;
  venue: string;
  floor?: string;
  room_area?: string;
  created_at: string;
  description: string;
  pipeline_state: string;
  status?: string;
  rejection_reason?: string;
  resolution_notes?: string;
  photos?: ComplaintPhoto[];
}

interface FleetBooking {
  id: string;
  destination?: string;
  purpose?: string;
  request_date: string;
  arrival_time?: string;
  assigned_vehicles?: string;
  departure_time?: string;
  pipeline_state: string;
}

export default function MyRequests() {
  const { showToast, toasts, removeToast } = useToast();
  const [activeTab, setActiveTab] = useState<'materials' | 'maintenance' | 'events' | 'fleet'>('materials');
  const { user: currentUser, role: userRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const navigate = useNavigate();

  // Cancel Modal State
  const [cancelModalEvent, setCancelModalEvent] = useState<BaseEventData | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');

  const [stats, setStats] = useState({ materialsActive: 0, complaintsActive: 0, eventsActive: 0, fleetActive: 0 });

  const [materials, setMaterials] = useState<MaterialReq[]>([]);
  const [complaints, setComplaints] = useState<ComplaintRecord[]>([]);
  const [events, setEvents] = useState<BaseEventData[]>([]);
  const [fleet, setFleet] = useState<FleetBooking[]>([]);

  const [activeBatch, setActiveBatch] = useState<WorkOrder | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);

  const fetchDashboardData = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);

    // STRICT USER ISOLATION: Fetch only requests created by this logged-in account
    const [matRes, compRes, evRes, fleetRes] = await Promise.all([
      supabase
        .from("work_orders")
        .select(`
          *, 
          logs:work_order_logs(author_id, created_at, message), 
          items:work_order_items(
            custom_item_name, 
            requested_qty, 
            status,
            inventory:inventory_items(name)
          )
        `)
        .eq("requester_id", currentUser.id)
        .order("created_at", { ascending: false })
        .limit(30),
        
      supabase
        .from("complaints")
        .select(`
          *,
          photos:complaint_photos(file_url)
        `)
        .eq("requester_id", currentUser.id)
        .order("created_at", { ascending: false })
        .limit(30),
        
      supabase
        .from("events")
        .select(`
          *, 
          requirements:event_requirements(*)
        `)
        .eq("requester_id", currentUser.id)
        .order("event_date", { ascending: true })
        .limit(30),
        
      supabase
        .from("vehicle_requests")
        .select("*")
        .eq("requester_id", currentUser.id)
        .order("request_date", { ascending: true })
        .limit(30)
    ]);

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
    setLoading(false);
  }, [currentUser]);

  useEffect(() => { 
    let isMounted = true;
    const run = async () => {
      if (isMounted) await fetchDashboardData();
    };
    run();
    return () => {
      isMounted = false;
    };
  }, [fetchDashboardData]);

  const confirmReceipt = async (batch: { id: string; batch_id: string }) => {
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
    } catch (err: unknown) {
      showToast("Error confirming receipt: " + (err instanceof Error ? err.message : 'Error'), "error");
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
    } catch (err: unknown) {
      showToast("Error cancelling event: " + (err instanceof Error ? err.message : 'Error'), "error");
    } finally {
      setProcessingId(null);
    }
  };

  const openChat = (batch: MaterialReq) => {
    setActiveBatch(batch as unknown as WorkOrder);
    setIsChatOpen(true);
  };

  const getDeliverySlaMessage = (req: MaterialReq) => {
    if (req.pipeline_state !== 'PROCESSING' && req.pipeline_state !== 'ACTION_REQUIRED') return null;
    const headActionLog = req.logs?.slice().reverse().find(l => l.message?.includes('processed') || l.message?.includes('split') || l.message?.includes('approved') || l.message?.includes('Stock'));
    const approvalTimestamp = headActionLog ? new Date(headActionLog.created_at) : (req.logs && req.logs.length > 0 ? new Date(req.logs[req.logs.length - 1].created_at) : new Date(req.created_at || 0));
    if (approvalTimestamp.getHours() < 15) {
      return { type: 'same_day', text: 'You will get the requested material today.', badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
    } else {
      return { type: 'next_day', text: 'We will try to deliver your requested material today or tomorrow as earliest as possible.', badgeClass: 'bg-amber-50 text-amber-800 border-amber-200' };
    }
  };

  const isStandardUser = userRole === 'REQUESTER';

  return (
    <div className="space-y-6 pb-24 max-w-6xl mx-auto animate-in fade-in duration-300">
      
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-brand-maroon to-brand-dark rounded-3xl p-6 md:p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-gold opacity-5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl md:text-3xl font-black text-brand-gold tracking-tight">
              {isStandardUser ? 'My Dashboard' : 'My Requests Tracker'}
            </h2>
            {!isStandardUser && (
              <span className="px-3 py-1 bg-brand-gold/20 text-brand-gold text-[9px] font-black uppercase tracking-widest rounded-lg border border-brand-gold/50 shadow-sm">
                {userRole.replace('_', ' ')}
              </span>
            )}
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
        <button 
          onClick={() => setActiveTab('materials')} 
          className={`px-5 py-3 text-xs uppercase tracking-widest font-black border-b-2 transition whitespace-nowrap flex items-center gap-2 ${activeTab === 'materials' ? 'border-brand-maroon text-brand-maroon' : 'border-transparent text-slate-400 hover:text-slate-700'}`}
        >
          <Package className="w-4 h-4" /> Materials
        </button>
        <button 
          onClick={() => setActiveTab('maintenance')} 
          className={`px-5 py-3 text-xs uppercase tracking-widest font-black border-b-2 transition whitespace-nowrap flex items-center gap-2 ${activeTab === 'maintenance' ? 'border-brand-maroon text-brand-maroon' : 'border-transparent text-slate-400 hover:text-slate-700'}`}
        >
          <Wrench className="w-4 h-4" /> Maintenance
        </button>
        <button 
          onClick={() => setActiveTab('events')} 
          className={`px-5 py-3 text-xs uppercase tracking-widest font-black border-b-2 transition whitespace-nowrap flex items-center gap-2 ${activeTab === 'events' ? 'border-brand-maroon text-brand-maroon' : 'border-transparent text-slate-400 hover:text-slate-700'}`}
        >
          <Calendar className="w-4 h-4" /> Events
        </button>
        {!isStandardUser && (
          <button 
            onClick={() => setActiveTab('fleet')} 
            className={`px-5 py-3 text-xs uppercase tracking-widest font-black border-b-2 transition whitespace-nowrap flex items-center gap-2 ${activeTab === 'fleet' ? 'border-brand-maroon text-brand-maroon' : 'border-transparent text-slate-400 hover:text-slate-700'}`}
          >
            <Car className="w-4 h-4" /> Fleet
          </button>
        )}
      </div>

      {/* Content Area */}
      <div className="space-y-4">
        <div className="flex justify-between items-center px-1">
          <h3 className="font-black text-xs uppercase tracking-wider text-slate-500">My {activeTab} Tickets</h3>
          <button 
            onClick={fetchDashboardData} 
            className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center space-x-1.5 hover:text-brand-maroon transition bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            <span>Sync</span>
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 font-bold animate-pulse bg-white rounded-3xl border border-slate-200">
            Loading your records...
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            
            {/* 1. MATERIALS LIST */}
            {activeTab === 'materials' && (
              materials.length === 0 ? (
                <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 text-slate-400 italic font-bold">
                  No material requisitions found.
                </div>
              ) : materials.map((req) => {
                const logs = req.logs || [];
                const hasUnread = logs.length > 0 && logs[logs.length - 1].author_id !== currentUser?.id;
                
                const allItems = req.items || [];
                const providedItems = allItems.filter((i: ReqItem) => i.status !== 'Not Provided' && i.status !== 'Rejected');
                const rejectedItems = allItems.filter((i: ReqItem) => i.status === 'Not Provided' || i.status === 'Rejected');
                
                const sla = getDeliverySlaMessage(req);

                const isSplitPOBatch = req.batch_id?.includes('-PO');

                return (
                  <div key={req.id} className={`bg-white rounded-3xl p-5 md:p-6 shadow-sm border flex flex-col justify-between gap-4 transition hover:shadow-md ${req.pipeline_state === 'REJECTED' ? 'border-red-200 bg-red-50/10' : 'border-slate-200'}`}>
                     <div>
                       {isSplitPOBatch && (
                         <div className="mb-3 px-3 py-1.5 bg-purple-50 border border-purple-200 rounded-xl text-purple-800 text-[11px] font-bold flex items-center justify-between">
                           <span>📋 Procurement Backlog (Split from original requisition)</span>
                           <span className="text-[9px] uppercase font-black bg-purple-200 px-1.5 py-0.5 rounded">PO in progress</span>
                         </div>
                       )}

                       <div className="flex justify-between items-start">
                         <div>
                           <span className="font-black text-brand-maroon text-base">{req.batch_id}</span>
                           <p className="text-xs font-bold text-slate-700 mt-0.5">{req.location}</p>
                         </div>
                         <div className="flex items-center gap-2">
                           {req.pipeline_state === "ACTION_REQUIRED" && (
                             <button 
                               onClick={() => confirmReceipt(req)} 
                               disabled={processingId === req.id} 
                               className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-wider rounded-xl text-[10px] flex items-center gap-1.5 shadow-sm transition disabled:opacity-50"
                             >
                               <CheckSquare className="w-3.5 h-3.5" /> Confirm Receipt
                             </button>
                           )}
                           <button 
                             onClick={() => openChat(req)} 
                             className="relative px-3 py-2 bg-slate-800 hover:bg-black text-white font-black uppercase tracking-wider rounded-xl text-[10px] flex items-center gap-1.5 shadow-sm transition"
                           >
                             {hasUnread && (
                               <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                                 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                 <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-500 border-2 border-white"></span>
                               </span>
                             )}
                             <MessageSquare className="w-3.5 h-3.5" /> Thread
                           </button>
                         </div>
                       </div>

                       {sla && (
                         <div className={`mt-3 p-3 rounded-2xl border flex items-start gap-2.5 ${sla.badgeClass}`}>
                           <Clock className="w-4 h-4 shrink-0 mt-0.5" />
                           <div className="text-xs font-bold leading-relaxed">
                             <span className="font-black uppercase tracking-wider text-[10px] block mb-0.5">Estimated Fulfillment:</span>
                             {sla.text}
                           </div>
                         </div>
                       )}

                       {/* Provided Items */}
                       {providedItems.length > 0 && (
                         <div className="mt-3 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-[11px] font-bold text-slate-600">
                           <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1.5">Items in Requisition:</span>
                           <div className="flex flex-wrap gap-2">
                             {providedItems.map((i: ReqItem, idx: number) => {
                               const isSubstituted = i.custom_item_name?.includes('[Alt for:');
                               const isReady = i.status === 'Available' || i.status === 'Stock Injected';
                               const isOrdered = i.status === 'Ordered' || i.status === 'PO Issued';

                               return (
                                 <div 
                                   key={idx} 
                                   className={`px-3 py-1.5 rounded-xl border text-[11px] font-bold flex items-center gap-2 shadow-sm ${
                                     isReady 
                                       ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                                       : isOrdered 
                                       ? 'bg-purple-50 border-purple-200 text-purple-800' 
                                       : 'bg-white border-slate-200 text-slate-700'
                                   }`}
                                 >
                                   <span>{i.inventory?.name || i.custom_item_name}</span>
                                   <span className="font-black text-brand-maroon">(x{i.requested_qty})</span>
                                   {isReady && (
                                     <span className="text-[9px] font-black uppercase bg-emerald-200/80 text-emerald-900 px-1.5 py-0.5 rounded">
                                       Ready for Pickup
                                     </span>
                                   )}
                                   {isOrdered && (
                                     <span className="text-[9px] font-black uppercase bg-purple-200/80 text-purple-900 px-1.5 py-0.5 rounded">
                                       In Procurement
                                     </span>
                                   )}
                                   {isSubstituted && (
                                     <span className="text-[9px] font-black uppercase bg-indigo-200/80 text-indigo-900 px-1.5 py-0.5 rounded">
                                       Substituted
                                     </span>
                                   )}
                                 </div>
                               );
                             })}
                           </div>
                         </div>
                       )}

                       {/* REJECTED / NOT PROVIDED ITEMS SECTION */}
                       {rejectedItems.length > 0 && (
                         <div className="mt-2.5 bg-red-50 p-3 rounded-xl border border-red-200">
                           <div className="flex items-center gap-1.5 text-red-700 mb-1.5">
                             <Ban className="w-3.5 h-3.5 text-red-600 shrink-0" />
                             <span className="text-[10px] font-black uppercase tracking-wider">Items Not Provided / Rejected:</span>
                           </div>
                           <div className="flex flex-wrap gap-1.5">
                             {rejectedItems.map((item: ReqItem, idx: number) => (
                               <span key={idx} className="bg-white px-2.5 py-1 rounded-lg border border-red-200 text-red-600 text-[11px] font-bold flex items-center gap-1.5 shadow-sm">
                                 <span className="line-through">{item.inventory?.name || item.custom_item_name} (x{item.requested_qty})</span>
                                 <span className="text-[9px] bg-red-100 text-red-700 px-1 py-0.5 rounded font-black uppercase tracking-tight">Rejected</span>
                               </span>
                             ))}
                           </div>
                         </div>
                       )}

                     </div>
                     <VisualPipelineStepper type="REQUISITION" pipelineState={req.pipeline_state} />
                  </div>
                );
              })
            )}

            {/* 2. MAINTENANCE LIST */}
            {activeTab === 'maintenance' && (
              complaints.length === 0 ? (
                <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 text-slate-400 italic font-bold">
                  No maintenance complaints registered.
                </div>
              ) : complaints.map((c) => (
                <div 
                  key={c.id} 
                  onClick={() => navigate(`/?action_ticket=${c.complaint_id}`)}
                  className={`bg-white rounded-3xl p-5 md:p-6 shadow-sm border flex flex-col justify-between gap-4 transition hover:shadow-md cursor-pointer ${c.pipeline_state === 'REJECTED' ? 'border-red-200 hover:border-red-300 bg-red-50/20' : 'border-slate-200 hover:border-slate-300'}`}
                >
                   <div>
                     <div className="flex justify-between items-start">
                       <div>
                         <div className="flex items-center gap-2">
                           <span className="font-black text-brand-maroon text-base">{c.complaint_id}</span>
                           {c.pipeline_state === 'REJECTED' && (
                             <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest bg-red-100 text-red-700 border border-red-200">
                               Declined
                             </span>
                           )}
                         </div>
                         <h4 className="font-bold text-slate-800 text-sm mt-0.5">{c.category}</h4>
                         <p className="text-xs text-slate-500 font-bold mt-0.5">
                           {c.zone} - {c.venue} {c.floor && c.floor !== 'N/A' ? `• ${c.floor}` : ''} {c.room_area && c.room_area !== 'N/A' ? `(${c.room_area})` : ''}
                         </p>
                       </div>
                       <span className="text-[10px] font-bold text-slate-400 uppercase">{new Date(c.created_at).toLocaleDateString()}</span>
                     </div>

                     {/* HIGH-READABILITY REQUEST QUERY BOX */}
                     <div className="mt-4 bg-slate-50 p-4 rounded-2xl border border-slate-200 border-l-4 border-l-brand-maroon shadow-sm">
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 flex items-center gap-1.5">
                         <FileText className="w-3.5 h-3.5 text-brand-maroon" /> Reported Issue / Query:
                       </span>
                       <p className="text-sm md:text-base text-slate-900 font-extrabold leading-relaxed whitespace-pre-wrap">
                         {c.description}
                       </p>
                     </div>

                     {/* REJECTION REASON DISPLAY */}
                     {c.pipeline_state === 'REJECTED' && (c.rejection_reason || c.resolution_notes || (c.status && c.status.startsWith('Rejected: '))) && (
                       <div className="mt-3 bg-red-50 p-3.5 rounded-xl border border-red-200 flex items-start gap-2.5">
                         <Ban className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                         <div>
                           <span className="text-[10px] font-black text-red-600 uppercase tracking-widest block mb-0.5">Request Declined</span>
                           <p className="text-xs md:text-sm font-bold text-red-900">
                             {c.rejection_reason || c.resolution_notes || c.status?.replace('Rejected: ', '') || ''}
                           </p>
                         </div>
                       </div>
                     )}

                     {/* UPLOADED IMAGE RENDERER */}
                     {c.photos && c.photos.length > 0 && (
                       <div className="mt-3 bg-slate-50/80 p-3.5 rounded-2xl border border-slate-100">
                         <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2.5 flex items-center gap-1">
                           <ImageIcon className="w-3.5 h-3.5" /> Attached Photos:
                         </span>
                         <div className="flex flex-wrap gap-2.5">
                           {c.photos.map((photo: ComplaintPhoto, idx: number) => (
                             <a 
                               key={idx} 
                               href={photo.file_url} 
                               target="_blank" 
                               rel="noopener noreferrer" 
                               onClick={(e) => e.stopPropagation()}
                               className="block w-24 h-24 rounded-xl overflow-hidden border border-slate-200 shadow-sm hover:opacity-80 transition cursor-zoom-in"
                             >
                               <img src={photo.file_url} alt={`Complaint Photo ${idx + 1}`} className="w-full h-full object-cover" />
                             </a>
                           ))}
                         </div>
                       </div>
                     )}
                   </div>
                   <VisualPipelineStepper type="COMPLAINT" pipelineState={c.pipeline_state} />
                </div>
              ))
            )}

            {/* 3. EVENTS LIST */}
            {activeTab === 'events' && (
              events.length === 0 ? (
                <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 text-slate-400 italic font-bold">
                  No event requests booked.
                </div>
              ) : events.map((e) => {
                const now = new Date();
                const [year, month, day] = e.event_date.split('-').map(Number);
                const eventDateObj = new Date(year, month - 1, day, 0, 0, 0);
                const todayObj = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
                const canCancel = eventDateObj.getTime() >= todayObj.getTime() && !['CLOSED', 'REJECTED'].includes(e.pipeline_state);
                
                const pendingReturns = e.requirements?.filter(r => r.return_status === 'PENDING_RETURN' || r.return_status === 'PARTIALLY_RETURNED') || [];
                const needsReturnReminder = e.pipeline_state === 'CLOSED' && pendingReturns.length > 0;

                return (
                  <div key={e.id} className={`bg-white rounded-3xl p-5 md:p-6 shadow-sm border flex flex-col justify-between gap-4 transition hover:shadow-md ${e.pipeline_state === 'REJECTED' ? 'border-red-200 bg-red-50/10' : 'border-slate-200'}`}>
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
                              onClick={(eEvent) => { eEvent.stopPropagation(); setCancelModalEvent(e); setCancelReason(''); }}
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

                      {/* Return Reminder Banner */}
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
              })
            )}

            {/* 4. FLEET LIST */}
            {activeTab === 'fleet' && !isStandardUser && (
              fleet.length === 0 ? (
                <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 text-slate-400 italic font-bold">
                  No fleet requests booked.
                </div>
              ) : fleet.map((f) => (
                <div key={f.id} className={`bg-white rounded-3xl p-5 md:p-6 shadow-sm border flex flex-col justify-between gap-4 transition hover:shadow-md ${f.pipeline_state === 'REJECTED' ? 'border-red-200 bg-red-50/10' : 'border-slate-200'}`}>
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
            )}

          </div>
        )}
      </div>

      {/* Cancellation Reason Modal */}
      {cancelModalEvent && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl p-6 animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="text-base font-black uppercase tracking-tight">Cancel Event Booking</h3>
              </div>
              <button onClick={() => setCancelModalEvent(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5"/>
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-4 font-medium">
              Cancelling <strong>"{cancelModalEvent.event_title}"</strong> on {new Date(cancelModalEvent.event_date).toLocaleDateString()} will release the venue and alert Tanzeem Operations.
            </p>
            <form onSubmit={handleCancelSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Reason for Cancellation</label>
                <textarea 
                  required 
                  rows={3} 
                  value={cancelReason} 
                  onChange={(e) => setCancelReason(e.target.value)} 
                  placeholder="e.g. Guest speaker rescheduled, class cancelled..." 
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-red-500" 
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => setCancelModalEvent(null)} 
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition"
                >
                  Keep Event
                </button>
                <button 
                  type="submit" 
                  disabled={processingId === cancelModalEvent.id} 
                  className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition disabled:opacity-50"
                >
                  {processingId === cancelModalEvent.id ? 'Cancelling...' : 'Confirm Cancellation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Action Toasts */}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div 
            key={t.id} 
            onClick={() => removeToast(t.id)} 
            className={`p-4 rounded-2xl shadow-2xl text-white text-sm font-bold flex items-center gap-3 pointer-events-auto cursor-pointer animate-in slide-in-from-bottom-5 duration-300 ${t.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'}`}
          >
            {t.type === 'error' ? <XCircle className="w-5 h-5"/> : <CheckCircle className="w-5 h-5"/>}
            {t.message}
          </div>
        ))}
      </div>

      {/* Batch Chat Thread Modal */}
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