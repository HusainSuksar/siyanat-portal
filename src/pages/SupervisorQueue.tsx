import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ClipboardList, CheckCircle, XCircle, Image as ImageIcon, MapPin } from 'lucide-react';

export default function SupervisorQueue() {
  const [complaints, setComplaints] = useState<any[]>([]);
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

      let query = supabase
        .from('complaints')
        .select(`
          *,
          requester:profiles(full_name, department),
          photos:complaint_photos(file_url)
        `)
        .eq('status', 'Pending Approval')
        .order('created_at', { ascending: true });

      // FIX: Use .ilike for more robust string matching, handling potential spaces/case issues
      if (profile?.role === 'SUPERVISOR' && profile?.zone) {
        query = query.ilike('zone', `%${profile.zone.trim()}%`);
      }

      const { data, error } = await query;
      if (data && !error) setComplaints(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  const processComplaint = async (id: string, complaintIdName: string) => {
    if (!confirm('Forward this complaint to the Siyanat Head for maintenance?')) return;
    setProcessingId(id);

    const { error } = await supabase
      .from('complaints')
      .update({ status: 'Approved by Supervisor' })
      .eq('id', id);

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

    const { error } = await supabase
      .from('complaints')
      .update({ status: 'Not Processed' })
      .eq('id', id);

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-brand-maroon flex items-center gap-2">
            <ClipboardList className="w-6 h-6" />
            Zone Supervisor Queue
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Review structural issues in your zone before sending to Siyanat Operations.
          </p>
        </div>
        {userProfile?.zone && (
          <div className="px-4 py-2 bg-brand-gold text-brand-maroon font-black text-xs uppercase tracking-widest rounded-lg shadow-sm border border-amber-300">
            Zone: {userProfile.zone}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 space-y-4">
        <h3 className="font-extrabold text-sm uppercase text-slate-800 border-b pb-3">Pending Reviews</h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 uppercase font-bold">
              <tr>
                <th className="p-3">Complaint ID</th>
                <th className="p-3">Requester</th>
                <th className="p-3">Location Details</th>
                <th className="p-3">Issue Description</th>
                <th className="p-3 text-right">Review Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr><td colSpan={5} className="p-6 text-center text-slate-500 font-medium animate-pulse">Loading queue...</td></tr>
              ) : complaints.length === 0 ? (
                <tr><td colSpan={5} className="p-6 text-center text-slate-500 font-medium italic">No pending complaints in your zone.</td></tr>
              ) : (
                complaints.map(c => {
                  const isUrgent = c.priority.includes('URGENT');

                  return (
                    <tr key={c.id} className="hover:bg-slate-50 transition">
                      <td className="p-3">
                        <div className="font-black text-brand-maroon tracking-wide">{c.complaint_id}</div>
                        <div className={`text-[9px] font-extrabold uppercase mt-1 px-1.5 py-0.5 rounded w-max ${isUrgent ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-700'}`}>
                          {c.priority}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-slate-800">{c.requester?.full_name || 'Unknown User'}</div>
                        <div className="text-[10px] text-slate-500">{c.requester?.department}</div>
                        {c.student_tr_no && <div className="text-[10px] text-brand-gold font-bold mt-0.5">TR: {c.student_tr_no}</div>}
                      </td>
                      <td className="p-3">
                        <div className="flex items-start gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5" />
                          <div>
                            <div className="font-bold text-slate-700">{c.venue}</div>
                            <div className="text-[10px] text-slate-500">{c.floor} • {c.room_area}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 max-w-xs">
                        <div className="font-bold text-slate-800 mb-1">{c.category}</div>
                        <div className="text-[11px] text-slate-600 line-clamp-2" title={c.description}>
                          {c.description}
                        </div>
                        {c.photos && c.photos.length > 0 && (
                          <div className="flex items-center gap-2 mt-2">
                            {c.photos.map((photo: any, idx: number) => (
                              <button 
                                key={idx} 
                                onClick={() => window.open(photo.file_url, '_blank')}
                                className="flex items-center gap-1 text-[9px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded transition"
                              >
                                <ImageIcon className="w-3 h-3" />
                                <span>Photo {idx + 1}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                          <button 
                            onClick={() => processComplaint(c.id, c.complaint_id)}
                            disabled={processingId === c.id}
                            className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[11px] shadow-sm transition flex items-center space-x-1 disabled:opacity-50"
                          >
                            <CheckCircle className="w-3 h-3" />
                            <span className="hidden sm:inline">Process</span>
                          </button>
                          <button 
                            onClick={() => doNotProcess(c.id, c.complaint_id)}
                            disabled={processingId === c.id}
                            className="px-2.5 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-[11px] shadow-sm transition flex items-center space-x-1 disabled:opacity-50"
                          >
                            <XCircle className="w-3 h-3" />
                            <span className="hidden sm:inline">Reject</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}