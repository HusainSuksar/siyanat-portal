import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CheckCircle, XCircle, Users, X, Clock, MapPin, History, ListFilter, ClipboardCheck, PackageCheck } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import type { BaseEventData } from '../../types/eventBooking';

interface DecisionState {
  id: string;
  item_name: string;
  status: 'Approved' | 'Rejected';
  is_returnable: boolean;
  approved_qty: number;
}

const PERIOD_END_TIMES: Record<string, string> = {
  P1: '09:00', P2: '09:35', P3: '10:10', P4: '10:45', P5: '11:35',
  P6: '12:10', P7: '12:45', P8: '13:20', P9: '15:00', P10: '15:45'
};

export default function EventsManager() {
  const { user } = useAuth();
  const { showToast } = useToast();
  
  const [viewMode, setViewMode] = useState<'active' | 'history'>('active');
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<BaseEventData[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Approval Modal State
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [targetEvent, setTargetEvent] = useState<BaseEventData | null>(null);
  const [reqDecisions, setReqDecisions] = useState<Record<string, DecisionState>>({});

  // Reconciliation Modal State
  const [reconcileModalOpen, setReconcileModalOpen] = useState(false);
  const [returnCounts, setReturnCounts] = useState<Record<string, number>>({});

  // Rejection Modal State
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const fetchInitialData = async () => {
    const { data } = await supabase.from('inventory_items').select('name, physical_stock, freezed_stock');
    if (data) setInventory(data);
  };

  const fetchEvents = async () => {
    setLoading(true);
    // Include SUBMITTED in the active queue
    const targetStates = viewMode === 'active' ? ['SUBMITTED', 'AUTHORIZED', 'PROCESSING'] : ['CLOSED', 'REJECTED'];

    const { data, error } = await supabase
      .from('events')
      .select(`
        *, 
        requester:profiles(full_name, department),
        requirements:event_requirements(*)
      `)
      .in('pipeline_state', targetStates)
      .order('event_date', { ascending: viewMode === 'active' });

    if (error) showToast('Failed to sync events', 'error');
    if (data) setEvents(data as BaseEventData[]);
    setLoading(false);
  };

  useEffect(() => { 
    fetchInitialData();
    fetchEvents(); 
  }, [viewMode]);

  // Evaluates if the exact date & time has elapsed
  const isEventPassed = (eventDate: string, timeSlot: string) => {
    if (!eventDate) return false;
    const now = new Date();
    const [year, month, day] = eventDate.split('-').map(Number);
    let endHour = 23;
    let endMin = 59;
    
    if (timeSlot) {
      const pMatch = timeSlot.match(/P\d+/g);
      if (pMatch && pMatch.length > 0) {
        const lastPeriod = pMatch[pMatch.length - 1];
        if (PERIOD_END_TIMES[lastPeriod]) {
          const [h, m] = PERIOD_END_TIMES[lastPeriod].split(':').map(Number);
          endHour = h;
          endMin = m;
        }
      } else {
        const customMatch = timeSlot.match(/(\d{2}):(\d{2})/g);
        if (customMatch && customMatch.length > 0) {
          const lastTime = customMatch[customMatch.length - 1];
          const [h, m] = lastTime.split(':').map(Number);
          endHour = h;
          endMin = m;
        }
      }
    }
    const eventEndTime = new Date(year, month - 1, day, endHour, endMin, 0);
    return now.getTime() >= eventEndTime.getTime();
  };

  // --- APPROVAL WORKFLOW ---
  const openApproveModal = (event: BaseEventData) => {
    setTargetEvent(event);
    const initialDecisions: Record<string, DecisionState> = {};
    
    if (event.requirements && event.requirements.length > 0) {
      event.requirements.forEach(req => {
        const defaultReturnable = req.department === 'AVIT_HEAD' || req.department === 'SIYANAT_HEAD';
        initialDecisions[req.id] = {
          id: req.id,
          item_name: req.item_name,
          status: 'Approved',
          is_returnable: req.is_returnable ?? defaultReturnable,
          approved_qty: req.quantity || 1
        };
      });
      setReqDecisions(initialDecisions);
      setApproveModalOpen(true);
    } else {
      processEventApproval(event.id, []);
    }
  };

  const processEventApproval = async (eventId: string, decisions: DecisionState[]) => {
    setProcessingId(eventId);
    try {
      const { error } = await supabase.rpc('process_event_approvals', {
        p_event_id: eventId,
        p_decisions: decisions,
        p_admin_email: user?.email
      });
      
      if (error) throw error;
      showToast('Event & accessories processed successfully!', 'success');
      setApproveModalOpen(false);
      fetchEvents();
      fetchInitialData();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setProcessingId(null);
    }
  };

  // --- RECONCILIATION WORKFLOW ---
  const openReconcileModal = (event: BaseEventData) => {
    setTargetEvent(event);
    const initialCounts: Record<string, number> = {};
    
    event.requirements?.filter(r => r.return_status === 'PENDING_RETURN' || r.return_status === 'PARTIALLY_RETURNED').forEach(req => {
      initialCounts[req.id] = req.approved_qty;
    });
    
    setReturnCounts(initialCounts);
    setReconcileModalOpen(true);
  };

  const handleReconcileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetEvent) return;
    setProcessingId(targetEvent.id);

    const returnsPayload = Object.entries(returnCounts).map(([id, qty]) => ({ id, returned_qty: qty }));

    try {
      const { error } = await supabase.rpc('reconcile_event_returns', {
        p_event_id: targetEvent.id,
        p_returns: returnsPayload,
        p_admin_email: user?.email
      });

      if (error) throw error;
      showToast('Assets successfully reconciled and stock restored.', 'success');
      setReconcileModalOpen(false);
      fetchEvents();
      fetchInitialData();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setProcessingId(null);
    }
  };

  // --- REJECTION & CLOSURE ---
  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetEvent || !rejectionReason.trim()) return;
    setProcessingId(targetEvent.id);

    try {
      const { error } = await supabase.from('events').update({ pipeline_state: 'REJECTED', rejection_reason: rejectionReason }).eq('id', targetEvent.id);
      if (error) throw error;

      if (targetEvent.requirements && targetEvent.requirements.length > 0) {
        const reqIds = targetEvent.requirements.map(r => r.id);
        await supabase.from('event_requirements').update({ status: 'Rejected' }).in('id', reqIds);
      }
      showToast('Event rejected and requester notified.', 'success');
      setRejectModalOpen(false);
      setRejectionReason('');
      fetchEvents();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const closeEvent = async (event: BaseEventData) => {
    setProcessingId(event.id);
    try {
      await supabase.from('events').update({ pipeline_state: 'CLOSED' }).eq('id', event.id);
      showToast('Event marked as concluded.', 'success');
      fetchEvents();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-white p-2 rounded-2xl border border-slate-200 shadow-sm w-full md:w-auto">
        <div className="flex gap-2 w-full">
          <button onClick={() => setViewMode('active')} className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition ${viewMode === 'active' ? 'bg-brand-maroon text-brand-gold shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}>
            <ListFilter className="w-4 h-4" /> Active Queue
          </button>
          <button onClick={() => setViewMode('history')} className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition ${viewMode === 'history' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}>
            <History className="w-4 h-4" /> History Log
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-slate-500 font-bold animate-pulse bg-white rounded-3xl border border-slate-200">Syncing database...</div>
      ) : events.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 shadow-sm">
          <p className="text-slate-400 font-bold uppercase tracking-wider text-xs">
            {viewMode === 'active' ? 'No pending events requiring action.' : 'No historical records found.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {events.map(e => {
            const hasPendingReturns = e.requirements?.some(r => r.return_status === 'PENDING_RETURN' || r.return_status === 'PARTIALLY_RETURNED');
            const isPassed = isEventPassed(e.event_date, e.time_slot);
            const isPendingReview = e.pipeline_state === 'SUBMITTED' || e.pipeline_state === 'AUTHORIZED';
            
            return (
            <div key={e.id} className={`bg-white rounded-3xl p-5 shadow-sm border flex flex-col lg:flex-row justify-between gap-5 transition hover:shadow-md ${e.pipeline_state === 'REJECTED' ? 'border-red-200' : 'border-slate-200'}`}>
               <div className="space-y-4 flex-1 w-full">
                  <div>
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <h3 className="font-black text-brand-maroon text-lg leading-tight">{e.event_title}</h3>
                        {e.pipeline_state === 'SUBMITTED' && (
                          <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest bg-amber-100 text-amber-800">
                            New Submission
                          </span>
                        )}
                      </div>
                      {viewMode === 'history' && (
                        <span className={`px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${e.pipeline_state === 'CLOSED' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                          {e.pipeline_state === 'CLOSED' ? 'Concluded' : 'Rejected'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1 font-bold flex items-center gap-1 uppercase">
                      <Users className="w-3 h-3"/> {e.requester?.full_name || 'Requester'} • {e.requester?.department || 'Campus'}
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                     <div>
                       <div className="flex items-center gap-1 text-slate-800 font-black text-xs"><Clock className="w-3.5 h-3.5 text-slate-400"/> {new Date(e.event_date).toLocaleDateString()}</div>
                       <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{e.timing_type}</div>
                       <div className="text-[10px] font-bold text-slate-600 mt-0.5 truncate max-w-[200px]" title={e.time_slot}>{e.time_slot}</div>
                     </div>
                     <div>
                       <div className="flex items-center gap-1 text-slate-800 font-black text-xs"><MapPin className="w-3.5 h-3.5 text-slate-400"/> {e.location}</div>
                       {e.sub_location && <div className="text-[10px] font-bold text-slate-500 mt-0.5 truncate">{e.sub_location}</div>}
                     </div>
                     <div>
                       <div className="font-black text-slate-700 text-xs tracking-wider">{e.darajah || 'All Darajah'}</div>
                       <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-0.5">Total Pax: <span className="text-brand-maroon">{e.total_count}</span></div>
                     </div>
                  </div>

                  {e.requirements && e.requirements.length > 0 && (
                    <div className="pt-3 border-t border-slate-100">
                      <span className="text-[10px] font-black uppercase text-slate-400 mb-2 block tracking-widest">Processed Accessories</span>
                      <div className="flex flex-wrap gap-2">
                        {e.requirements.map((req, i) => {
                          const isRejected = req.status === 'Rejected';
                          const isApproved = req.status === 'Approved';
                          return (
                            <div key={i} className={`px-2.5 py-1.5 text-[10px] font-bold rounded-lg border flex flex-col ${isRejected ? 'bg-red-50 text-red-800 border-red-100 opacity-70' : isApproved ? 'bg-emerald-50 text-emerald-800 border-emerald-100' : 'bg-amber-50 text-amber-800 border-amber-100'}`}>
                              <span className={isRejected ? 'line-through' : ''}>
                                {req.item_name} {isApproved && `(x${req.approved_qty || req.quantity})`}
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
               </div>

               {/* Actions Sidebar */}
               <div className="flex flex-row lg:flex-col gap-2 w-full lg:w-48 pt-4 lg:pt-0 border-t lg:border-t-0 lg:border-l border-slate-100 lg:pl-5 justify-center">
                  {viewMode === 'active' && isPendingReview && (
                    <>
                      <button onClick={() => openApproveModal(e)} disabled={processingId === e.id} className="flex-1 lg:flex-none py-3 px-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-wider text-[10px] rounded-xl shadow-sm flex items-center justify-center gap-1.5 transition">
                        <ClipboardCheck className="w-4 h-4"/> Review & Approve
                      </button>
                      <button onClick={() => { setTargetEvent(e); setRejectModalOpen(true); }} disabled={processingId === e.id} className="flex-1 lg:flex-none py-3 px-2 bg-white hover:bg-red-50 text-red-600 font-black uppercase tracking-wider text-[10px] rounded-xl border border-red-200 shadow-sm flex items-center justify-center gap-1.5 transition">
                        <XCircle className="w-4 h-4"/> Decline
                      </button>
                    </>
                  )}
                  {viewMode === 'active' && e.pipeline_state === 'PROCESSING' && !hasPendingReturns && (
                    <button onClick={() => closeEvent(e)} disabled={!isPassed || processingId === e.id} className="flex-1 lg:flex-none py-4 px-2 bg-slate-800 hover:bg-slate-900 text-white font-black uppercase tracking-wider text-[10px] rounded-xl shadow-sm flex items-center justify-center gap-1.5 transition disabled:opacity-50">
                      {isPassed ? <><CheckCircle className="w-4 h-4"/> Mark Concluded</> : <><Clock className="w-4 h-4"/> Pending Event</>}
                    </button>
                  )}
                  
                  {viewMode === 'active' && e.pipeline_state === 'PROCESSING' && hasPendingReturns && (
                    <button onClick={() => openReconcileModal(e)} disabled={!isPassed || processingId === e.id} className={`flex-1 lg:flex-none py-4 px-2 bg-brand-maroon hover:bg-red-900 text-white font-black uppercase tracking-wider text-[10px] rounded-xl shadow-sm flex items-center justify-center gap-1.5 transition disabled:opacity-50 ${isPassed ? 'animate-pulse' : 'disabled:animate-none'}`}>
                      {isPassed ? <><PackageCheck className="w-4 h-4"/> Reconcile Returns</> : <><Clock className="w-4 h-4"/> Pending Event</>}
                    </button>
                  )}
               </div>
            </div>
          )})}
        </div>
      )}

      {/* --- REVIEW & APPROVE MODAL --- */}
      {approveModalOpen && targetEvent && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-5 bg-emerald-600 text-white flex justify-between items-center">
              <div>
                <h3 className="font-extrabold uppercase text-sm">Review Event Accessories</h3>
                <p className="text-[10px] text-emerald-100 font-bold mt-0.5">{targetEvent.event_title}</p>
              </div>
              <button onClick={() => setApproveModalOpen(false)} className="hover:text-emerald-200 transition"><X className="w-5 h-5"/></button>
            </div>
            
            <form onSubmit={(e) => { e.preventDefault(); processEventApproval(targetEvent.id, Object.values(reqDecisions)); }} className="p-6 max-h-[75vh] overflow-y-auto">
              <p className="text-xs text-slate-500 font-bold mb-5">
                Classify items and allocate quantities. Consumables will deduct stock; Returnables will freeze stock until returned.
              </p>
              
              <div className="space-y-4">
                {targetEvent.requirements?.map(req => {
                  const state = reqDecisions[req.id];
                  const invItem = inventory.find(i => i.name === req.item_name);
                  
                  return (
                    <div key={req.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="text-sm font-bold text-slate-800">{req.item_name}</div>
                        <div className="text-[10px] text-slate-500 uppercase font-black tracking-widest mt-1">
                          Requested: {req.quantity}
                          {invItem && <span className="ml-2 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">Avail Stock: {invItem.physical_stock - invItem.freezed_stock}</span>}
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-2">
                        <select 
                          value={state.is_returnable ? 'Returnable' : 'Consumable'}
                          onChange={(e) => setReqDecisions({...reqDecisions, [req.id]: {...state, is_returnable: e.target.value === 'Returnable'}})}
                          disabled={state.status === 'Rejected'}
                          className="p-2.5 rounded-xl text-xs font-black uppercase tracking-wider outline-none border focus:ring-2 focus:ring-emerald-500 bg-white border-slate-300 disabled:opacity-50"
                        >
                          <option value="Returnable">🔄 Returnable</option>
                          <option value="Consumable">📦 Consumable</option>
                        </select>

                        <div className="flex items-center bg-white border border-slate-300 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-emerald-500">
                          <span className="px-2 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 h-full flex items-center border-r border-slate-300">QTY</span>
                          <input 
                            type="number" min="1" max={req.quantity}
                            value={state.approved_qty}
                            disabled={state.status === 'Rejected'}
                            onChange={(e) => setReqDecisions({...reqDecisions, [req.id]: {...state, approved_qty: parseInt(e.target.value) || 1}})}
                            className="w-16 p-2.5 text-xs font-bold text-center outline-none disabled:bg-slate-50"
                          />
                        </div>

                        <select 
                          value={state.status} 
                          onChange={(e) => setReqDecisions({...reqDecisions, [req.id]: {...state, status: e.target.value as 'Approved'|'Rejected'}})}
                          className={`p-2.5 rounded-xl text-xs font-black uppercase tracking-wider outline-none border ${state.status === 'Approved' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}
                        >
                          <option value="Approved">Approve</option>
                          <option value="Rejected">Reject</option>
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button type="submit" disabled={processingId === targetEvent.id} className="w-full py-4 mt-6 bg-slate-900 hover:bg-black text-white font-black rounded-xl uppercase text-xs tracking-wider transition disabled:opacity-50">
                Confirm Approvals & Allocate Stock
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- RECONCILE RETURNS MODAL --- */}
      {reconcileModalOpen && targetEvent && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-5 bg-brand-maroon text-brand-gold flex justify-between items-center">
              <h3 className="font-extrabold uppercase text-sm">Reconcile Event Returns</h3>
              <button onClick={() => setReconcileModalOpen(false)} className="hover:text-white transition"><X className="w-5 h-5"/></button>
            </div>
            <form onSubmit={handleReconcileSubmit} className="p-6 space-y-4">
              <p className="text-xs text-slate-500 font-bold mb-4">
                Verify returned quantities. Any missing items will be permanently written off from warehouse inventory.
              </p>
              
              <div className="space-y-3">
                {targetEvent.requirements?.filter(r => r.return_status === 'PENDING_RETURN' || r.return_status === 'PARTIALLY_RETURNED').map(req => (
                  <div key={req.id} className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div>
                      <div className="text-sm font-bold text-slate-800">{req.item_name}</div>
                      <div className="text-[10px] text-brand-maroon uppercase font-black tracking-widest mt-1">Loaned: {req.approved_qty}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Received:</span>
                      <input 
                        type="number" min="0" max={req.approved_qty}
                        value={returnCounts[req.id]} 
                        onChange={(e) => setReturnCounts({...returnCounts, [req.id]: parseInt(e.target.value) || 0})}
                        className="w-20 p-2.5 rounded-lg text-sm font-black text-center outline-none border focus:ring-2 focus:ring-brand-maroon"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <button type="submit" disabled={processingId === targetEvent.id} className="w-full py-4 mt-6 bg-brand-maroon hover:bg-red-900 text-white font-black rounded-xl uppercase text-xs tracking-wider transition disabled:opacity-50 flex items-center justify-center gap-2">
                <PackageCheck className="w-5 h-5" /> Confirm Returns & Restore Stock
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- REJECTION MODAL --- */}
      {rejectModalOpen && targetEvent && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-5 bg-red-600 text-white flex justify-between items-center">
              <h3 className="font-extrabold uppercase text-sm">Decline Event Entirely</h3>
              <button onClick={() => setRejectModalOpen(false)} className="hover:text-red-200 transition"><X className="w-5 h-5"/></button>
            </div>
            <form onSubmit={handleRejectSubmit} className="p-6 space-y-4">
              <p className="text-xs text-slate-500 font-bold">Please provide a reason for declining this venue booking:</p>
              <textarea 
                required 
                placeholder="Reason for declining..." 
                value={rejectionReason} 
                onChange={e => setRejectionReason(e.target.value)} 
                className="w-full p-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-red-500 text-sm min-h-[100px]"
              />
              <button type="submit" disabled={processingId === targetEvent.id} className="w-full py-4 bg-red-600 hover:bg-red-700 text-white font-black rounded-xl uppercase text-xs tracking-wider transition disabled:opacity-50">
                Confirm Decline
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}