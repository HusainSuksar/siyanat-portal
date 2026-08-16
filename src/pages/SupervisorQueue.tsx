import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ClipboardList, CheckCircle, XCircle, Image as ImageIcon, MapPin, SearchCheck, RefreshCcw, ShieldCheck, Mailbox } from 'lucide-react';

export default function SupervisorQueue() {
  const [activeTab, setActiveTab] = useState<'inbox' | 'verification'>('inbox');
  const [complaints, setComplaints] = useState<any[]>([]);
  const [verifications, setVerifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);

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

      // Build base query
      let baseQuery = supabase
        .from('complaints')
        .select(`
          *,
          requester:profiles(full_name, department),
          photos:complaint_photos(file_url),
          assignments:technician_assignments(status, technician:profiles!technician_assignments_technician_id_fkey(full_name, trade))
        `)
        .order('created_at', { ascending: true });

      // Apply Zone Filter
      if (profile?.role === 'SUPERVISOR' && profile?.zone) {
        baseQuery = baseQuery.ilike('zone', `%${profile.zone.trim()}%`);
      }

      const { data, error } = await baseQuery;
      
      if (data && !error) {
        // Split data into the two queues
        setComplaints(data.filter(c => c.status === 'Pending Approval'));
        setVerifications(data.filter(c => c.status === 'Completed'));
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchQueue();
  }, [activeTab]);

  // --- TAB 1: INITIAL APPROVAL ACTIONS ---
  const processComplaint = async (id: string, complaintIdName: string) => {
    if (!confirm('Forward this complaint to Siyanat Operations for maintenance scheduling?')) return;
    setProcessingId(id);

    const { error } = await supabase.from('complaints').update({ status: 'Approved by Supervisor' }).eq('id', id);

    if (!error) {
      await supabase.from('system_logs').insert({
        action_type: 'SUPERVISOR_APPROVED',
        description: `Supervisor approved complaint ${complaintIdName} and forwarded to Siyanat Operations.`,
        user_email: userProfile?.email || 'Supervisor'
      });
      fetchQueue();
    } else {
      alert('Error updating status.');
    }
    setProcessingId(null);
  };

  const doNotProcess = async (id: string, complaintIdName: string) => {
    const reason = prompt('Please enter the mandatory reason for NOT processing this complaint:');
    if (!reason) {
      alert('A reason is required to reject a complaint.');
      return;
    }
    
    setProcessingId(id);
    const { error } = await supabase.from('complaints').update({ status: 'Not Processed' }).eq('id', id);

    if (!error) {
      await supabase.from('system_logs').insert({
        action_type: 'SUPERVISOR_REJECTED',
        description: `Supervisor rejected complaint ${complaintIdName}. Reason: ${reason}`,
        user_email: userProfile?.email || 'Supervisor'
      });
      fetchQueue();
    }
    setProcessingId(null);
  };

  // --- TAB 2: VERIFICATION ACTIONS ---
  const verifyComplaint = async (id: string, complaintIdName: string) => {
    if (!confirm('Officially verify that the technician has successfully completed this maintenance? This will close the ticket.')) return;
    setProcessingId(id);

    const { error } = await supabase.from('complaints').update({ status: 'Verified' }).eq('id', id);

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

  const reopenComplaint = async (id: string, complaintIdName: string) => {
    const reason = prompt('Why does this complaint need to be reopened? (The technician will be notified)');
    if (!reason) {
      alert('A reason is required to reopen a complaint.');
      return;
    }
    
    setProcessingId(id);
    
    // Set complaint status back to Assigned/Reopened
    const { error: compError } = await supabase.from('complaints').update({ status: 'Complaint Reopened' }).eq('id', id);
    // Set the assignment status back
    await supabase.from('technician_assignments').update({ status: 'Assigned' }).eq('complaint_id', id).eq('status', 'Completed');

    if (!compError) {
      await supabase.from('system_logs').insert({
        action_type: 'SUPERVISOR_REOPENED',
        description: `Supervisor reopened complaint ${complaintIdName} due to unsatisfactory fix. Reason: ${reason}`,
        user_email: userProfile?.email || 'Supervisor'
      });
      fetchQueue();
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
      </div>

      {/* --- TAB 1: INBOX / NEW APPROVALS --- */}
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
                        className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-wider rounded-xl text-[10px] shadow-sm transition flex justify-center items-center gap-2 disabled:opacity-50"
                      >
                        <CheckCircle className="w-4 h-4" /> Approve
                      </button>
                      <button 
                        onClick={() => doNotProcess(c.id, c.complaint_id)}
                        disabled={processingId === c.id}
                        className="flex-1 py-3 bg-white hover:bg-red-50 text-red-600 font-black uppercase tracking-wider rounded-xl border border-red-200 text-[10px] shadow-sm transition flex justify-center items-center gap-2 disabled:opacity-50"
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
              <p className="text-[10px] font-medium text-slate-400 mt-1">Technicians have not marked any new jobs as complete.</p>
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
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-black text-brand-maroon tracking-wider text-sm">{c.complaint_id}</div>
                          <div className="font-bold text-slate-800 text-lg mt-0.5 leading-tight">{c.category}</div>
                        </div>
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
                        onClick={() => reopenComplaint(c.id, c.complaint_id)}
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
    </div>
  );
}