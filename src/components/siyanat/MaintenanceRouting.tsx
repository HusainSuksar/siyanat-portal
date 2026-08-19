import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/useToast';
import { Wrench, UserPlus, X } from 'lucide-react';

export default function MaintenanceRouting({ userRole }: { userRole: string }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState<any>(null);
  const [selectedTechId, setSelectedTechId] = useState('');

  const fetchMaintenance = async () => {
    setLoading(true);
    let query = supabase.from('complaints').select(`*, requester:profiles(full_name, department), assignments:technician_assignments(status, technician:profiles!technician_assignments_technician_id_fkey(full_name, trade))`).in('pipeline_state', ['AUTHORIZED', 'PROCESSING', 'ACTION_REQUIRED']).order('created_at', { ascending: false });
    
    if (userRole === 'SIYANAT_HEAD') query = query.neq('category', 'AVIT');
    if (userRole === 'AVIT_HEAD') query = query.eq('category', 'AVIT');

    const [compRes, techRes] = await Promise.all([query, supabase.from('profiles').select('id, full_name, trade').eq('role', 'EXECUTOR')]);

    if (compRes.data) setComplaints(compRes.data);
    if (techRes.data) setTechnicians(techRes.data);
    setLoading(false);
  };

  useEffect(() => { fetchMaintenance(); }, [userRole]);

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTechId || !selectedComplaint) return;
    setProcessingId(selectedComplaint.id);

    try {
      await supabase.from('technician_assignments').insert({ complaint_id: selectedComplaint.id, technician_id: selectedTechId, assigned_by: user?.id });
      if(selectedComplaint.pipeline_state === 'AUTHORIZED') {
         await supabase.rpc('advance_pipeline', { target_table: 'complaints', target_id: selectedComplaint.id });
      } else {
         await supabase.from('complaints').update({ status: 'Assigned' }).eq('id', selectedComplaint.id);
      }
      showToast("Technician Dispatched!", "success");
      setAssignModalOpen(false);
      fetchMaintenance();
    } catch(err: any) {
      showToast("Assignment failed: " + err.message, "error");
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) return <div className="p-8 text-center animate-pulse text-slate-500">Loading complaints...</div>;
  if (complaints.length === 0) return <div className="p-12 text-center text-slate-500 font-bold"><Wrench className="w-12 h-12 mx-auto mb-3 opacity-20"/> No maintenance tasks.</div>;

  return (
    <div className="space-y-4">
      {complaints.map(c => (
        <div key={c.id} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex justify-between gap-4">
          <div className="flex-1">
            <h3 className="font-black text-brand-maroon">{c.complaint_id}</h3>
            <p className="text-xs text-slate-500 mt-1">{c.category} • {c.venue}</p>
          </div>
          <div className="flex flex-col gap-2 w-48">
            <button onClick={() => { setSelectedComplaint(c); setAssignModalOpen(true); }} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex justify-center gap-1.5"><UserPlus className="w-4 h-4"/> Assign</button>
          </div>
        </div>
      ))}

      {assignModalOpen && selectedComplaint && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden">
            <div className="bg-brand-maroon p-5 flex justify-between text-white"><h3 className="font-bold uppercase">Dispatch Tech</h3><button onClick={() => setAssignModalOpen(false)}><X className="w-5 h-5"/></button></div>
            <form onSubmit={handleAssign} className="p-6 space-y-5">
              <select required value={selectedTechId} onChange={e => setSelectedTechId(e.target.value)} className="w-full p-3.5 border rounded-xl outline-none">
                <option value="" disabled>-- Select Tradesman --</option>
                {technicians.map(t => <option key={t.id} value={t.id}>{t.full_name} ({t.trade || 'General'})</option>)}
              </select>
              <button type="submit" disabled={!!processingId} className="w-full py-3.5 bg-indigo-600 text-white font-bold rounded-xl">Confirm Dispatch</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}