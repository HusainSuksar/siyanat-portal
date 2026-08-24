import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CheckCircle, XCircle, Users, X, Clock, MapPin, History, ListFilter, ClipboardCheck } from 'lucide-react';
import { useToast } from '../../hooks/useToast';

export interface TanzeemEvent {
  id: string;
  event_title: string;
  event_date: string;
  timing_type: string;
  time_slot: string;
  location: string;
  sub_location: string | null;
  darajah: string;
  total_count: number;
  pipeline_state: string;
  rejection_reason?: string;
  requester_id: string;
  requester?: { full_name: string; department: string };
  requirements?: { id: string; item_name: string; department?: string; status?: string }[];
}

export default function EventsManager() {
  const { user } = useAuth();
  const { showToast } = useToast();
  
  const [viewMode, setViewMode] = useState<'active' | 'history'>('active');
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<TanzeemEvent[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Requirement Approval Modal State
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [reqDecisions, setReqDecisions] = useState<Record<string, string>>({});

  // Rejection Modal State
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [targetEvent, setTargetEvent] = useState<TanzeemEvent | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const fetchEvents = async () => {
    setLoading(true);
    
    const targetStates = viewMode === 'active' 
      ? ['AUTHORIZED', 'PROCESSING'] 
      : ['CLOSED', 'REJECTED'];

    const { data, error } = await supabase
      .from('events')
      .select(`
        *, 
        requester:profiles(full_name, department),
        requirements:event_requirements(id, item_name, department, status)
      `)
      .in('pipeline_state', targetStates)
      .order('event_date', { ascending: viewMode === 'active' });

    if (error) showToast('Failed to sync events', 'error');
    if (data) setEvents(data as TanzeemEvent[]);
    setLoading(false);
  };

  useEffect(() => { fetchEvents(); }, [viewMode]);

  // Open Approval Modal & Set Defaults
  const openApproveModal = (event: TanzeemEvent) => {
    setTargetEvent(event);
    const initialDecisions: Record<string, string> = {};
    
    if (event.requirements && event.requirements.length > 0) {
      event.requirements.forEach(req => {
        initialDecisions[req.id] = 'Approved'; // Default to Approved
      });
      setReqDecisions(initialDecisions);
      setApproveModalOpen(true);
    } else {
      // If no requirements exist, bypass modal and approve immediately
      processEventApproval(event.id, event.event_title, {});
    }
  };

  // Process Full Event & Requirement Approvals
  const handleApproveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetEvent) return;
    await processEventApproval(targetEvent.id, targetEvent.event_title, reqDecisions);
    setApproveModalOpen(false);
  };

  const processEventApproval = async (eventId: string, title: string, decisions: Record<string, string>) => {
    setProcessingId(eventId);
    try {
      // 1. Update individual requirement statuses if any exist
      if (Object.keys(decisions).length > 0) {
        const updates = Object.entries(decisions).map(([reqId, status]) => 
          supabase.from('event_requirements').update({ status }).eq('id', reqId)
        );
        await Promise.all(updates);
      }

      // 2. Advance Event Pipeline to 'PROCESSING'
      const { error } = await supabase.rpc('advance_pipeline', { target_table: 'events', target_id: eventId });
      if (error) throw error;

      await supabase.from('system_logs').insert({ 
        action_type: 'EVENT_APPROVED', 
        description: `Approved venue booking & requirements for: ${title}.`, 
        user_email: user?.email || 'Admin' 
      });

      showToast('Event & accessories processed successfully!', 'success');
      fetchEvents();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetEvent || !rejectionReason.trim()) return;
    setProcessingId(targetEvent.id);

    try {
      // Mark event as rejected
      const { error } = await supabase.from('events').update({ 
        pipeline_state: 'REJECTED', 
        rejection_reason: rejectionReason 
      }).eq('id', targetEvent.id);
      
      if (error) throw error;

      // Auto-reject all associated requirements
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

  const closeEvent = async (event: TanzeemEvent) => {
    setProcessingId(event.id);
    try {
      await supabase.from('events').update({ pipeline_state: 'CLOSED' }).eq('id', event.id);
      
      await supabase.from('system_logs').insert({ 
        action_type: 'EVENT_CLOSED', 
        description: `Concluded event: ${event.event_title}.`, 
        user_email: user?.email || 'Admin' 
      });
      
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
          <button 
            onClick={() => setViewMode('active')} 
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition ${viewMode === 'active' ? 'bg-brand-maroon text-brand-gold shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}
          >
            <ListFilter className="w-4 h-4" /> Active Queue
          </button>
          <button 
            onClick={() => setViewMode('history')} 
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition ${viewMode === 'history' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}
          >
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
          {events.map(e => (
            <div key={e.id} className={`bg-white rounded-3xl p-5 shadow-sm border flex flex-col lg:flex-row justify-between gap-5 transition hover:shadow-md ${e.pipeline_state === 'REJECTED' ? 'border-red-200' : 'border-slate-200'}`}>
               <div className="space-y-4 flex-1 w-full">
                  <div>
                    <div className="flex justify-between items-start">
                      <h3 className="font-black text-brand-maroon text-lg leading-tight">{e.event_title}</h3>
                      {viewMode === 'history' && (
                        <span className={`px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${e.pipeline_state === 'CLOSED' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                          {e.pipeline_state === 'CLOSED' ? 'Concluded' : 'Rejected'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1 font-bold flex items-center gap-1 uppercase">
                      <Users className="w-3 h-3"/> {e.requester?.full_name} • {e.requester?.department}
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
                       <div className="font-black text-slate-700 text-xs tracking-wider">{e.darajah}</div>
                       <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-0.5">Total Pax: <span className="text-brand-maroon">{e.total_count}</span></div>
                     </div>
                  </div>

                  {/* Requirements List with Status Styling */}
                  {e.requirements && e.requirements.length > 0 && (
                    <div className="pt-3 border-t border-slate-100">
                      <span className="text-[10px] font-black uppercase text-slate-400 mb-2 block tracking-widest">Requested Accessories</span>
                      <div className="flex flex-wrap gap-2">
                        {e.requirements.map((req, i) => {
                          const isRejected = req.status === 'Rejected';
                          const isApproved = req.status === 'Approved';
                          return (
                            <span 
                              key={i} 
                              className={`px-2 py-1 text-[10px] font-bold rounded border ${
                                isRejected 
                                  ? 'bg-red-50 text-red-800 border-red-100 line-through opacity-70' 
                                  : isApproved 
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-100' 
                                    : 'bg-amber-50 text-amber-800 border-amber-100'
                              }`}
                            >
                              {req.item_name} {isRejected && '(Rejected)'}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {viewMode === 'history' && e.pipeline_state === 'REJECTED' && e.rejection_reason && (
                    <div className="bg-red-50 p-3 rounded-xl border border-red-100">
                      <span className="text-[10px] font-black text-red-600 uppercase tracking-widest block mb-1">Reason for Rejection</span>
                      <p className="text-xs font-semibold text-red-900">{e.rejection_reason}</p>
                    </div>
                  )}
               </div>

               {viewMode === 'active' && (
                 <div className="flex flex-row lg:flex-col gap-2 w-full lg:w-48 pt-4 lg:pt-0 border-t lg:border-t-0 lg:border-l border-slate-100 lg:pl-5 justify-center">
                    {e.pipeline_state === 'AUTHORIZED' ? (
                      <>
                        <button onClick={() => openApproveModal(e)} disabled={processingId === e.id} className="flex-1 lg:flex-none py-3 px-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-wider text-[10px] rounded-xl shadow-sm flex items-center justify-center gap-1.5 transition disabled:opacity-50">
                          <ClipboardCheck className="w-4 h-4"/> Review & Approve
                        </button>
                        <button onClick={() => { setTargetEvent(e); setRejectModalOpen(true); }} disabled={processingId === e.id} className="flex-1 lg:flex-none py-3 px-2 bg-white hover:bg-red-50 text-red-600 font-black uppercase tracking-wider text-[10px] rounded-xl border border-red-200 shadow-sm flex items-center justify-center gap-1.5 transition disabled:opacity-50">
                          <XCircle className="w-4 h-4"/> Decline
                        </button>
                      </>
                    ) : (
                      <button onClick={() => closeEvent(e)} disabled={processingId === e.id} className="flex-1 lg:flex-none py-4 px-2 bg-slate-800 hover:bg-slate-900 text-white font-black uppercase tracking-wider text-[10px] rounded-xl shadow-sm flex items-center justify-center gap-1.5 transition disabled:opacity-50">
                        <CheckCircle className="w-4 h-4"/> Mark Concluded
                      </button>
                    )}
                 </div>
               )}
            </div>
          ))}
        </div>
      )}

      {/* Requirement Approval Modal */}
      {approveModalOpen && targetEvent && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-5 bg-emerald-600 text-white flex justify-between items-center">
              <div>
                <h3 className="font-extrabold uppercase text-sm">Approve Event & Accessories</h3>
                <p className="text-[10px] text-emerald-100 font-bold mt-0.5">{targetEvent.event_title}</p>
              </div>
              <button onClick={() => setApproveModalOpen(false)} className="hover:text-emerald-200 transition"><X className="w-5 h-5"/></button>
            </div>
            <form onSubmit={handleApproveSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <p className="text-xs text-slate-500 font-bold mb-4">
                Please review the requested accessories. You can reject specific items while still approving the event.
              </p>
              
              <div className="space-y-3">
                {targetEvent.requirements?.map(req => (
                  <div key={req.id} className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-200 shadow-sm">
                    <div>
                      <div className="text-sm font-bold text-slate-800">{req.item_name}</div>
                      <div className="text-[9px] text-slate-500 uppercase font-black tracking-widest">{req.department}</div>
                    </div>
                    <select 
                      value={reqDecisions[req.id]} 
                      onChange={(e) => setReqDecisions({...reqDecisions, [req.id]: e.target.value})}
                      className={`p-2 rounded-lg text-xs font-bold outline-none border focus:ring-2 focus:ring-emerald-500 ${reqDecisions[req.id] === 'Approved' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}
                    >
                      <option value="Approved">Approved</option>
                      <option value="Rejected">Rejected</option>
                    </select>
                  </div>
                ))}
              </div>

              <button type="submit" disabled={processingId === targetEvent.id} className="w-full py-4 mt-6 bg-slate-900 hover:bg-black text-white font-black rounded-xl uppercase text-xs tracking-wider transition disabled:opacity-50">
                Confirm Approvals
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
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