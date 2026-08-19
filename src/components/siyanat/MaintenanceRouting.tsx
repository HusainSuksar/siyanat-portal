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
      // THE FIX: Explicitly check for errors and throw them so the catch block triggers
      const { error: assignError } = await supabase.from('technician_assignments').insert({ 
        complaint_id: selectedComplaint.id, 
        technician_id: selectedTechId, 
        assigned_by: user?.id 
      });
      
      if (assignError) throw assignError;

      // Only advance the pipeline if it hasn't been moved to processing yet
      if (selectedComplaint.pipeline_state === 'AUTHORIZED') {
         const { error: advanceError } = await supabase.rpc('advance_pipeline', { target_table: 'complaints', target_id: selectedComplaint.id });
         if (advanceError) throw advanceError;
      }
      
      showToast("Technician Assigned successfully!", "success");
      setAssignModalOpen(false);
      setSelectedTechId('');
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
            
            {/* Added: Visually indicate if a technician is already assigned */}
            {c.assignments && c.assignments.length > 0 && (
              <p className="text-[10px] font-bold text-indigo-600 mt-2 uppercase tracking-wider bg-indigo-50 inline-block px-2 py-1 rounded border border-indigo-100">
                Assigned to: {c.assignments[0].technician?.full_name}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2 w-48">
            <button onClick={() => { setSelectedComplaint(c); setAssignModalOpen(true); }} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex justify-center gap-1.5 transition shadow-sm">
              <UserPlus className="w-4 h-4"/> {c.assignments && c.assignments.length > 0 ? 'Reassign' : 'Assign'}
            </button>
          </div>
        </div>
      ))}

      {assignModalOpen && selectedComplaint && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="bg-brand-maroon p-5 flex justify-between text-white items-center">
              <h3 className="font-bold uppercase text-sm">Assign Technician</h3>
              <button onClick={() => setAssignModalOpen(false)} className="hover:text-red-200 transition"><X className="w-5 h-5"/></button>
            </div>
            <form onSubmit={handleAssign} className="p-6 space-y-5">
              <div>
                <label className="block text-[11px] font-black text-slate-500 uppercase mb-2">Select Tradesman *</label>
                <select required value={selectedTechId} onChange={e => setSelectedTechId(e.target.value)} className="w-full p-3.5 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-brand-maroon bg-slate-50 text-sm font-bold transition">
                  <option value="" disabled>-- Select Tradesman --</option>
                  {technicians.map(t => <option key={t.id} value={t.id}>{t.full_name} ({t.trade || 'General'})</option>)}
                </select>
              </div>
              <button type="submit" disabled={!!processingId} className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-widest rounded-xl transition shadow-lg disabled:opacity-50">
                Confirm Assignment
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}