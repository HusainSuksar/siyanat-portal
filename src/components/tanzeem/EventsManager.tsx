import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CheckCircle, XCircle, Users, X, Clock, MapPin, History, ListFilter } from 'lucide-react';
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
  requirements?: { item_name: string; department?: string }[];
}

export default function EventsManager() {
  const { user } = useAuth();
  const { showToast } = useToast();
  
  // THE NEW FEATURE: Toggle between Active Queue and History Archive
  const [viewMode, setViewMode] = useState<'active' | 'history'>('active');
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<TanzeemEvent[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Rejection Modal State
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [targetEvent, setTargetEvent] = useState<TanzeemEvent | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const fetchEvents = async () => {
    setLoading(true);
    
    // Switch database target based on the view mode
    const targetStates = viewMode === 'active' 
      ? ['AUTHORIZED', 'PROCESSING'] 
      : ['CLOSED', 'REJECTED'];

    const { data, error } = await supabase
      .from('events')
      .select(`
        *, 
        requester:profiles(full_name, department),
        requirements:event_requirements(item_name, department)
      `)
      .in('pipeline_state', targetStates)
      .order('event_date', { ascending: viewMode === 'active' }); // Show oldest first for Active, newest first for History

    if (error) showToast('Failed to sync events', 'error');
    if (data) setEvents(data as TanzeemEvent[]);
    setLoading(false);
  };

  // Re-fetch whenever the toggle is clicked
  useEffect(() => { fetchEvents(); }, [viewMode]);

  const approveEvent = async (event: TanzeemEvent) => {
    setProcessingId(event.id);
    try {
      const { error } = await supabase.rpc('advance_pipeline', { target_table: 'events', target_id: event.id });
      if (error) throw error;

      await supabase.from('system_logs').insert({ 
        action_type: 'EVENT_APPROVED', 
        description: `Approved venue booking: ${event.event_title}.`, 
        user_email: user?.email || 'Admin' 
      });

      showToast('Event approved successfully!', 'success');
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
      const { error } = await supabase.from('events').update({ 
        pipeline_state: 'REJECTED', 
        rejection_reason: rejectionReason 
      }).eq('id', targetEvent.id);
      
      if (error) throw error;

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
      {/* View Mode Toggle Switch */}
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
                      {/* Show status badge in history mode */}
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
                  
                  {/* RESTORED: The full detailed UI Grid */}
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

                  {/* RESTORED: Accessories & Requirements List */}
                  {e.requirements && e.requirements.length > 0 && (
                    <div className="pt-3 border-t border-slate-100">
                      <span className="text-[10px] font-black uppercase text-slate-400 mb-2 block tracking-widest">Requested Accessories</span>
                      <div className="flex flex-wrap gap-2">
                        {e.requirements.map((req, i) => (
                          <span key={i} className="px-2 py-1 bg-amber-50 text-amber-800 text-[10px] font-bold rounded border border-amber-100">
                            {req.item_name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Show rejection reason if applicable in history */}
                  {viewMode === 'history' && e.pipeline_state === 'REJECTED' && e.rejection_reason && (
                    <div className="bg-red-50 p-3 rounded-xl border border-red-100">
                      <span className="text-[10px] font-black text-red-600 uppercase tracking-widest block mb-1">Reason for Rejection</span>
                      <p className="text-xs font-semibold text-red-900">{e.rejection_reason}</p>
                    </div>
                  )}
               </div>

               {/* Action Buttons (Only visible in Active mode) */}
               {viewMode === 'active' && (
                 <div className="flex flex-row lg:flex-col gap-2 w-full lg:w-48 pt-4 lg:pt-0 border-t lg:border-t-0 lg:border-l border-slate-100 lg:pl-5 justify-center">
                    {e.pipeline_state === 'AUTHORIZED' ? (
                      <>
                        <button onClick={() => approveEvent(e)} disabled={processingId === e.id} className="flex-1 lg:flex-none py-3 px-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-wider text-[10px] rounded-xl shadow-sm flex items-center justify-center gap-1.5 transition disabled:opacity-50">
                          <CheckCircle className="w-4 h-4"/> Confirm
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

      {/* Rejection Modal */}
      {rejectModalOpen && targetEvent && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-4 bg-red-600 text-white flex justify-between items-center">
              <h3 className="font-bold uppercase text-sm">Decline Event</h3>
              <button onClick={() => setRejectModalOpen(false)} className="hover:text-red-200 transition"><X className="w-5 h-5"/></button>
            </div>
            <form onSubmit={handleRejectSubmit} className="p-5 space-y-4">
              <p className="text-xs text-slate-500 font-bold">Please provide a reason for declining this venue booking:</p>
              <textarea 
                required 
                placeholder="Reason for declining..." 
                value={rejectionReason} 
                onChange={e => setRejectionReason(e.target.value)} 
                className="w-full p-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-red-500 text-sm min-h-[100px]"
              />
              <button type="submit" disabled={processingId === targetEvent.id} className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl uppercase text-xs tracking-wider transition disabled:opacity-50">
                Confirm Decline
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}