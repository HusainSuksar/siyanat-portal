import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ClipboardList, CheckCircle, XCircle, Image as ImageIcon, MapPin, SearchCheck, RefreshCcw, ShieldCheck, Mailbox, X, History } from 'lucide-react';

export default function SupervisorQueue() {
  const [activeTab, setActiveTab] = useState<'inbox' | 'verification' | 'history'>('inbox');
  const [complaints, setComplaints] = useState<any[]>([]);
  const [verifications, setVerifications] = useState<any[]>([]);
  const [historyLog, setHistoryLog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);

  const [reasonModalOpen, setReasonModalOpen] = useState(false);
  const [modalAction, setModalAction] = useState<'REJECT' | 'REOPEN'>('REJECT');
  const [targetComplaint, setTargetComplaint] = useState<any>(null);
  const [reasonText, setReasonText] = useState('');

  const fetchQueue = async () => {
    setLoading(true);
    const { data: authData } = await supabase.auth.getUser();
    
    if (authData.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, zone')
        .eq('id', authData.user.id)
        .single();
      
      setUserProfile({ ...profile, email: authData.user.email });

      let baseQuery = supabase
        .from('complaints')
        .select(`
          *,
          requester:profiles(full_name, department),
          photos:complaint_photos(file_url),
          assignments:technician_assignments(status, technician:profiles!technician_assignments_technician_id_fkey(full_name, trade))
        `)
        .order('created_at', { ascending: false }); // Sort newest first for history

      if (profile?.role === 'SUPERVISOR' && profile?.zone) {
        const assignedZones = profile.zone.split(',').map((z: string) => z.trim());
        baseQuery = baseQuery.in('zone', assignedZones);
      }

      const { data, error } = await baseQuery;
      
      if (data && !error) {
        setComplaints(data.filter(c => c.pipeline_state === 'SUBMITTED'));
        setVerifications(data.filter(c => c.pipeline_state === 'ACTION_REQUIRED'));
        // History includes Approved (Processing), Verified (Closed), and Rejected
        setHistoryLog(data.filter(c => ['PROCESSING', 'CLOSED', 'REJECTED'].includes(c.pipeline_state)));
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchQueue();
  }, [activeTab]);

  const processComplaint = async (id: string, complaintIdName: string) => {
    if (!confirm('Forward this complaint to Siyanat Operations for maintenance scheduling?')) return;
    setProcessingId(id);

    const { error } = await supabase.rpc('advance_pipeline', { target_table: 'complaints', target_id: id });

    if (!error) {
      await supabase.from('system_logs').insert({
        action_type: 'SUPERVISOR_APPROVED',
        description: `Supervisor approved complaint ${complaintIdName} and forwarded to Siyanat Operations.`,
        user_email: userProfile?.email || 'Supervisor'
      });
      fetchQueue();
    } else {
      alert('Error advancing pipeline.');
    }
    setProcessingId(null);
  };

  const openReasonModal = (complaint: any, action: 'REJECT' | 'REOPEN') => {
    setTargetComplaint(complaint);
    setModalAction(action);
    setReasonText('');
    setReasonModalOpen(true);
  };

  const handleReasonSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reasonText.trim() || !targetComplaint) return;
    setProcessingId(targetComplaint.id);

    if (modalAction === 'REJECT') {
      const { error } = await supabase.from('complaints').update({ pipeline_state: 'REJECTED', rejection_reason: reasonText }).eq('id', targetComplaint.id);
      if (!error) {
        await supabase.from('system_logs').insert({
          action_type: 'SUPERVISOR_REJECTED',
          description: `Supervisor rejected complaint ${targetComplaint.complaint_id}. Reason: ${reasonText}`,
          user_email: userProfile?.email || 'Supervisor'
        });
      }
    } else {
      const { error: compError } = await supabase.from('complaints').update({ pipeline_state: 'PROCESSING' }).eq('id', targetComplaint.id);
      await supabase.from('technician_assignments').update({ status: 'Assigned' }).eq('complaint_id', targetComplaint.id);

      if (!compError) {
        await supabase.from('system_logs').insert({
          action_type: 'SUPERVISOR_REOPENED',
          description: `Supervisor reopened complaint ${targetComplaint.complaint_id}. Reason: ${reasonText}`,
          user_email: userProfile?.email || 'Supervisor'
        });
      }
    }

    setReasonModalOpen(false);
    fetchQueue();
    setProcessingId(null);
  };

  const verifyComplaint = async (id: string, complaintIdName: string) => {
    if (!confirm('Officially verify that the technician has successfully completed this maintenance? This will close the ticket.')) return;
    setProcessingId(id);

    const { error } = await supabase.rpc('advance_pipeline', { target_table: 'complaints', target_id: id });

    if (!error) {
      await supabase.from('system_logs').insert({
        action_type: 'SUPERVISOR_VERIFIED',
        description: `Supervisor officially verified and signed-off on complaint ${complaintIdName}.`,
        user_email: userProfile?.email || 'Supervisor'
      });
      fetchQueue();
    } else {
      alert('Error verifying complaint.');
    }
    setProcessingId(null);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-24">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-3xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-4">
          <div className="bg-brand-maroon/10 p-3 rounded-2xl">
            <ShieldCheck className="w-8 h-8 text-brand-maroon" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-800 tracking-tight">Zone Supervisor Authority</h2>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mt-1">
              Approve new requests and verify completed maintenance.
            </p>
          </div>
        </div>
        {userProfile?.zone && (
          <div className="px-5 py-2.5 bg-brand-maroon text-brand-gold font-black text-xs uppercase tracking-widest rounded-xl shadow-md border border-brand-dark/20 flex items-center gap-2 w-full sm:w-auto justify-center">
            <MapPin className="w-4 h-4" /> Zone: {userProfile.zone}
          </div>
        )}
      </div>

      <div className="flex space-x-2 border-b border-slate-200 overflow-x-auto pb-1">
        <button onClick={() => setActiveTab('inbox')} className={`px-5 py-3 text-xs uppercase tracking-widest font-black border-b-2 transition flex items-center gap-2 whitespace-nowrap ${activeTab === 'inbox' ? 'border-brand-maroon text-brand-maroon' : 'border-transparent text-slate-400 hover:text-slate-700'}`}>
          <Mailbox className="w-4 h-4" /> Pending Approvals
          {complaints.length > 0 && <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded-full ml-1">{complaints.length}</span>}
        </button>
        <button onClick={() => setActiveTab('verification')} className={`px-5 py-3 text-xs uppercase tracking-widest font-black border-b-2 transition flex items-center gap-2 whitespace-nowrap ${activeTab === 'verification' ? 'border-brand-maroon text-brand-maroon' : 'border-transparent text-slate-400 hover:text-slate-700'}`}>
          <SearchCheck className="w-4 h-4" /> Pending Sign-off
          {verifications.length > 0 && <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full ml-1">{verifications.length}</span>}
        </button>
        <button onClick={() => setActiveTab('history')} className={`px-5 py-3 text-xs uppercase tracking-widest font-black border-b-2 transition flex items-center gap-2 whitespace-nowrap ${activeTab === 'history' ? 'border-brand-maroon text-brand-maroon' : 'border-transparent text-slate-400 hover:text-slate-700'}`}>
          <History className="w-4 h-4" /> History Log
        </button>
      </div>

      {/* --- TAB 1: INBOX --- */}
      {activeTab === 'inbox' && (
        <div className="space-y-4">
          {loading ? (
            <div className="p-8 text-center text-slate-500 font-bold animate-pulse bg-white rounded-3xl border border-slate-200 shadow-sm">Loading queue...</div>
          ) : complaints.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 shadow-sm">
              <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-bold uppercase tracking-wider text-xs">No pending complaints in your zone.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {complaints.map(c => {
                const isUrgent = c.priority.includes('URGENT');

                return (
                  <div key={c.id} className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200 flex flex-col lg:flex-row justify-between gap-5 transition hover:shadow-md">
                    <div className="flex-1 space-y-4 w-full">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-black text-brand-maroon tracking-wider text-sm">{c.complaint_id}</div>
                          <div className="font-bold text-slate-800 text-lg mt-0.5 leading-tight">{c.category}</div>
                        </div>
                        <div className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-lg border shadow-sm ${isUrgent ? 'bg-red-50 text-red-700 border-red-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                          {c.priority}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <div>
                          <div className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">Requester</div>
                          <div className="font-bold text-slate-800 text-xs">{c.requester?.full_name || 'Unknown User'}</div>
                          <div className="text-[10px] font-semibold text-slate-500 mt-0.5">{c.requester?.department}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">Location</div>
                          <div className="font-bold text-slate-800 text-xs">{c.venue}</div>
                          <div className="text-[10px] font-semibold text-slate-500 mt-0.5">{c.floor} • {c.room_area}</div>
                        </div>
                      </div>

                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <div className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1.5">Description</div>
                        <p className="text-[11px] text-slate-700 font-medium leading-relaxed whitespace-pre-wrap">{c.description}</p>
                        
                        {c.photos && c.photos.length > 0 && (
                          <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-slate-200">
                            {c.photos.map((photo: any, idx: number) => (
                              <button key={idx} onClick={() => window.open(photo.file_url, '_blank')} className="flex items-center gap-1.5 text-[10px] font-black text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 px-3 py-1.5 rounded-lg transition shadow-sm">
                                <ImageIcon className="w-3.5 h-3.5" /> Photo {idx + 1}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-row lg:flex-col gap-2 w-full lg:w-48 pt-4 lg:pt-0 border-t lg:border-t-0 lg:border-l border-slate-100 lg:pl-5">
                      <button 
                        onClick={() => processComplaint(c.id, c.complaint_id)}
                        disabled={processingId === c.id}
                        className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-wider rounded-xl text-[10px] shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 transition"
                      >
                        <CheckCircle className="w-4 h-4" /> Approve
                      </button>
                      <button 
                        onClick={() => openReasonModal(c, 'REJECT')}
                        disabled={processingId === c.id}
                        className="flex-1 py-3 bg-white hover:bg-red-50 text-red-600 font-black uppercase tracking-wider rounded-xl border border-red-200 text-[10px] shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 transition"
                      >
                        <XCircle className="w-4 h-4" /> Reject
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* --- TAB 2: VERIFICATION SIGN-OFF --- */}
      {activeTab === 'verification' && (
        <div className="space-y-4">
          {loading ? (
            <div className="p-8 text-center text-slate-500 font-bold animate-pulse bg-white rounded-3xl border border-slate-200 shadow-sm">Loading verifications...</div>
          ) : verifications.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 shadow-sm">
              <SearchCheck className="w-12 h-12 text-emerald-200 mx-auto mb-3" />
              <p className="text-slate-500 font-bold uppercase tracking-wider text-xs">No pending sign-offs.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {verifications.map(c => {
                const assignedTech = c.assignments?.[0]?.technician?.full_name || 'Unknown Tech';

                return (
                  <div key={c.id} className="bg-white rounded-3xl p-5 shadow-sm border-2 border-emerald-400 flex flex-col lg:flex-row justify-between gap-5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[8px] font-black uppercase tracking-widest px-3 py-1 rounded-bl-xl shadow-sm">
                      Needs Verification
                    </div>
                    
                    <div className="flex-1 space-y-4 w-full pt-2">
                      <div>
                        <div className="font-black text-brand-maroon tracking-wider text-sm">{c.complaint_id}</div>
                        <div className="font-bold text-slate-800 text-lg mt-0.5 leading-tight">{c.category}</div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100">
                        <div>
                          <div className="text-[10px] text-emerald-800/60 uppercase font-black tracking-widest mb-1">Completed By</div>
                          <div className="font-bold text-emerald-900 text-xs">{assignedTech}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-emerald-800/60 uppercase font-black tracking-widest mb-1">Location</div>
                          <div className="font-bold text-emerald-900 text-xs">{c.venue}</div>
                          <div className="text-[10px] font-semibold text-emerald-800 mt-0.5">{c.floor} • {c.room_area}</div>
                        </div>
                      </div>

                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <div className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1.5">Original Issue</div>
                        <p className="text-[11px] text-slate-700 font-medium leading-relaxed whitespace-pre-wrap">{c.description}</p>
                      </div>
                    </div>

                    <div className="flex flex-row lg:flex-col gap-2 w-full lg:w-48 pt-4 lg:pt-0 border-t lg:border-t-0 lg:border-l border-slate-100 lg:pl-5 justify-center">
                      <button 
                        onClick={() => verifyComplaint(c.id, c.complaint_id)}
                        disabled={processingId === c.id}
                        className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-wider rounded-xl text-[10px] shadow-md transition flex flex-col justify-center items-center gap-1.5 disabled:opacity-50 h-20"
                      >
                        <ShieldCheck className="w-5 h-5" /> Verify & Close
                      </button>
                      <button 
                        onClick={() => openReasonModal(c, 'REOPEN')}
                        disabled={processingId === c.id}
                        className="flex-1 py-3 bg-white hover:bg-red-50 text-red-600 font-black uppercase tracking-wider rounded-xl border-2 border-red-200 text-[10px] shadow-sm transition flex flex-col justify-center items-center gap-1.5 disabled:opacity-50 h-20"
                      >
                        <RefreshCcw className="w-5 h-5" /> Reopen Issue
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* --- TAB 3: HISTORY LOG --- */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {loading ? (
            <div className="p-8 text-center text-slate-500 font-bold animate-pulse bg-white rounded-3xl border border-slate-200 shadow-sm">Loading history...</div>
          ) : historyLog.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 shadow-sm">
              <History className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-bold uppercase tracking-wider text-xs">No historical records found.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {historyLog.map(c => {
                const assignedTech = c.assignments?.[0]?.technician?.full_name;

                return (
                  <div key={c.id} className={`bg-white rounded-3xl p-5 shadow-sm border ${c.pipeline_state === 'REJECTED' ? 'border-red-200' : 'border-slate-200'} flex flex-col gap-5 transition hover:shadow-md`}>
                    <div className="flex-1 w-full">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <div className="font-black text-brand-maroon tracking-wider text-sm">{c.complaint_id}</div>
                          <div className="font-bold text-slate-800 text-lg mt-0.5 leading-tight">{c.category}</div>
                        </div>
                        <span className={`px-2.5 py-1 rounded text-[9px] font-black uppercase tracking-widest ${
                          c.pipeline_state === 'CLOSED' ? 'bg-emerald-100 text-emerald-800' : 
                          c.pipeline_state === 'REJECTED' ? 'bg-red-100 text-red-700' : 
                          'bg-indigo-100 text-indigo-800'
                        }`}>
                          {c.pipeline_state === 'PROCESSING' ? 'Approved (In Progress)' : 
                           c.pipeline_state === 'CLOSED' ? 'Verified & Closed' : 'Rejected'}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 mb-4">
                        <div>
                          <div className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">Requester</div>
                          <div className="font-bold text-slate-800 text-xs">{c.requester?.full_name || 'Unknown User'}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">Location</div>
                          <div className="font-bold text-slate-800 text-xs">{c.venue}</div>
                          <div className="text-[10px] font-semibold text-slate-500 mt-0.5">{c.room_area}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">Assigned Tech</div>
                          <div className="font-bold text-indigo-700 text-xs">{assignedTech || 'Pending Assignment'}</div>
                        </div>
                      </div>

                      {c.pipeline_state === 'REJECTED' && c.rejection_reason && (
                        <div className="bg-red-50 p-3 rounded-xl border border-red-100">
                          <span className="text-[10px] font-black text-red-600 uppercase tracking-widest block mb-1">Rejection Reason</span>
                          <p className="text-xs font-semibold text-red-900">{c.rejection_reason}</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* IN-APP REASON MODAL */}
      {reasonModalOpen && targetComplaint && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className={`p-5 flex justify-between items-center text-white ${modalAction === 'REJECT' ? 'bg-red-600' : 'bg-slate-900'}`}>
              <h3 className="font-extrabold text-sm uppercase">
                {modalAction === 'REJECT' ? 'Reject Complaint' : 'Reopen Maintenance Ticket'}
              </h3>
              <button onClick={() => setReasonModalOpen(false)}><X className="w-5 h-5 hover:text-slate-300" /></button>
            </div>

            <form onSubmit={handleReasonSubmit} className="p-6 space-y-4">
              <p className="text-xs text-slate-500 font-bold">
                {modalAction === 'REJECT' 
                  ? 'Please provide a mandatory reason for not processing this complaint:' 
                  : 'Please state why this work is unsatisfactory. The technician will be re-assigned:'}
              </p>

              <textarea 
                required 
                rows={3} 
                value={reasonText} 
                onChange={(e) => setReasonText(e.target.value)} 
                placeholder="Enter detailed reason..." 
                className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-brand-maroon resize-none"
              />

              <button 
                type="submit" 
                disabled={processingId === targetComplaint.id || !reasonText.trim()}
                className={`w-full py-3.5 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-md transition disabled:opacity-50 ${modalAction === 'REJECT' ? 'bg-red-600 hover:bg-red-700' : 'bg-slate-900 hover:bg-black'}`}
              >
                {modalAction === 'REJECT' ? 'Confirm Rejection' : 'Reopen & Notify Technician'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}