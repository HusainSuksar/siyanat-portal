// src/components/tanzeem/EventsManager.tsx
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {  CheckCircle, XCircle,   Users, X } from 'lucide-react';
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
  requester_id: string;
  requester?: { full_name: string; department: string };
}

export default function EventsManager() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<TanzeemEvent[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Rejection Modal State (Replaces native prompt)
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [targetEvent, setTargetEvent] = useState<TanzeemEvent | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const fetchEvents = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('events')
      .select(`*, requester:profiles(full_name, department)`)
      .in('pipeline_state', ['AUTHORIZED', 'PROCESSING'])
      .order('event_date', { ascending: true });

    if (error) showToast('Failed to sync events', 'error');
    if (data) setEvents(data as TanzeemEvent[]);
    setLoading(false);
  };

  useEffect(() => { fetchEvents(); }, []);

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

  if (loading) return <div className="p-8 text-center animate-pulse">Loading events...</div>;
  if (events.length === 0) return <div className="p-12 text-center text-slate-500 font-bold">No pending events.</div>;

  return (
    <div className="grid grid-cols-1 gap-4">
      {events.map(e => (
        <div key={e.id} className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200 flex flex-col lg:flex-row justify-between gap-5">
           {/* UI matches original component */}
           <div className="space-y-4 flex-1 w-full">
              <div>
                <h3 className="font-black text-brand-maroon text-lg leading-tight">{e.event_title}</h3>
                <p className="text-xs text-slate-500 mt-1 font-bold flex items-center gap-1 uppercase">
                  <Users className="w-3 h-3"/> {e.requester?.full_name} • {e.requester?.department}
                </p>
              </div>
              {/* Timing & Location Blocks Omitted for Brevity - Keep your original JSX here */}
           </div>

           <div className="flex flex-row lg:flex-col gap-2 w-full lg:w-48 pt-4 lg:pt-0 border-t lg:border-t-0 lg:border-l border-slate-100 lg:pl-5">
              {e.pipeline_state === 'AUTHORIZED' ? (
                <>
                  <button onClick={() => approveEvent(e)} disabled={processingId === e.id} className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] rounded-xl shadow-sm flex items-center justify-center gap-2 transition disabled:opacity-50">
                    <CheckCircle className="w-4 h-4"/> Confirm
                  </button>
                  <button onClick={() => { setTargetEvent(e); setRejectModalOpen(true); }} disabled={processingId === e.id} className="flex-1 py-3 bg-white hover:bg-red-50 text-red-600 font-black uppercase text-[10px] rounded-xl border border-red-200 shadow-sm flex items-center justify-center gap-2 transition disabled:opacity-50">
                    <XCircle className="w-4 h-4"/> Decline
                  </button>
                </>
              ) : (
                <button onClick={() => closeEvent(e)} disabled={processingId === e.id} className="flex-1 py-3 bg-slate-800 hover:bg-slate-900 text-white font-black uppercase text-[10px] rounded-xl shadow-sm flex items-center justify-center gap-2 transition disabled:opacity-50">
                  <CheckCircle className="w-4 h-4"/> Mark Concluded
                </button>
              )}
           </div>
        </div>
      ))}

      {/* Replaces native prompt() */}
      {rejectModalOpen && targetEvent && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden">
            <div className="p-4 bg-red-600 text-white flex justify-between">
              <h3 className="font-bold uppercase">Decline Event</h3>
              <button onClick={() => setRejectModalOpen(false)}><X className="w-5 h-5"/></button>
            </div>
            <form onSubmit={handleRejectSubmit} className="p-5 space-y-4">
              <textarea 
                required 
                placeholder="Reason for declining..." 
                value={rejectionReason} 
                onChange={e => setRejectionReason(e.target.value)} 
                className="w-full p-3 border rounded-xl outline-none"
              />
              <button type="submit" disabled={processingId === targetEvent.id} className="w-full py-3 bg-red-600 text-white font-bold rounded-xl uppercase">Confirm Decline</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}