import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/useToast';
import { Wrench, UserPlus, X, ListFilter, History as HistoryIcon, MessageCircle } from 'lucide-react';

export default function MaintenanceRouting({ userRole }: { userRole: string }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  
  const [viewMode, setViewMode] = useState<'active' | 'history'>('active');
  const [loading, setLoading] = useState(true);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState<any>(null);
  const [selectedTechId, setSelectedTechId] = useState('');

  const fetchMaintenance = async () => {
    setLoading(true);
    
    const targetStates = viewMode === 'active' 
      ? ['AUTHORIZED', 'PROCESSING', 'ACTION_REQUIRED'] 
      : ['CLOSED', 'REJECTED'];

    let query = supabase.from('complaints')
      .select(`
        *,
        requester:profiles(full_name, department),
        assignments:technician_assignments(status, technician:profiles!technician_assignments_technician_id_fkey(id, full_name, trade, phone_number))
      `)
      .in('pipeline_state', targetStates)
      .order('created_at', { ascending: false });
    
    if (userRole === 'SIYANAT_HEAD') query = query.neq('category', 'AVIT');
    if (userRole === 'AVIT_HEAD') query = query.eq('category', 'AVIT');

    const [compRes, techRes] = await Promise.all([
      query, 
      supabase.from('profiles').select('id, full_name, trade, phone_number').eq('role', 'EXECUTOR')
    ]);

    if (compRes.data) setComplaints(compRes.data);
    if (techRes.data) setTechnicians(techRes.data);
    setLoading(false);
  };

  useEffect(() => { fetchMaintenance(); }, [userRole, viewMode]);

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTechId || !selectedComplaint) return;
    setProcessingId(selectedComplaint.id);

    try {
      const { error: assignError } = await supabase.from('technician_assignments').insert({ 
        complaint_id: selectedComplaint.id, 
        technician_id: selectedTechId, 
        assigned_by: user?.id 
      });
      
      if (assignError) throw assignError;

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

  // Helper to generate pre-formatted WhatsApp dispatch message
  const openWhatsAppDispatch = (complaint: any) => {
    const tech = complaint.assignments?.[0]?.technician;
    if (!tech?.phone_number) {
      alert("No phone number saved for this technician. Please update their profile.");
      return;
    }

    // Clean phone number (strip spaces, dashes, ensure country code)
    let cleanPhone = tech.phone_number.replace(/\D/g, '');
    if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone; // Default to India (+91) if 10 digits

    const text = `*SIYANAT MAINTENANCE DISPATCH* 🛠️\n\n`
      + `*Ticket ID:* ${complaint.complaint_id}\n`
      + `*Category:* ${complaint.category}\n`
      + `*Priority:* ${complaint.priority}\n`
      + `*Location:* ${complaint.zone} - ${complaint.venue} (${complaint.floor || ''} ${complaint.room_area || ''})\n`
      + `*Requester:* ${complaint.requester?.full_name} (${complaint.requester?.department || ''})\n\n`
      + `*Issue Description:*\n${complaint.description}\n\n`
      + `_Please proceed to the venue and update status in your Technician Dashboard upon completion._`;

    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-4">
      {/* View Mode Toggle Switch */}
      <div className="flex justify-between items-center bg-white p-2 rounded-2xl border border-slate-200 shadow-sm w-full md:w-auto mb-4">
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
            <HistoryIcon className="w-4 h-4" /> History Log
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center animate-pulse text-slate-500 font-bold bg-white rounded-3xl border border-slate-200">Loading complaints...</div>
      ) : complaints.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 shadow-sm">
          <Wrench className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-bold uppercase tracking-wider text-xs">
            {viewMode === 'active' ? 'No maintenance tasks.' : 'No historical records found.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {complaints.map(c => {
            const hasTechAssigned = c.assignments && c.assignments.length > 0;
            const tech = hasTechAssigned ? c.assignments[0].technician : null;

            return (
              <div key={c.id} className={`bg-white rounded-3xl p-5 shadow-sm border flex flex-col md:flex-row justify-between gap-4 transition hover:shadow-md ${c.pipeline_state === 'REJECTED' ? 'border-red-200' : 'border-slate-200'}`}>
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <h3 className="font-black text-brand-maroon text-lg">{c.complaint_id}</h3>
                    {viewMode === 'history' && (
                      <span className={`px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${c.pipeline_state === 'CLOSED' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                        {c.pipeline_state === 'CLOSED' ? 'Resolved' : 'Rejected'}
                      </span>
                    )}
                  </div>
                  
                  <p className="text-xs text-slate-600 mt-1 font-bold">{c.category} • {c.venue}</p>
                  <p className="text-[10px] font-bold text-slate-500 mt-1 uppercase tracking-wider">{c.requester?.full_name} • {c.requester?.department}</p>
                  
                  {hasTechAssigned && (
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-[10px] font-black text-indigo-600 uppercase tracking-wider bg-indigo-50 inline-block px-2.5 py-1 rounded border border-indigo-100">
                        {viewMode === 'history' ? 'Resolved By:' : 'Assigned To:'} {tech?.full_name}
                      </span>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                {viewMode === 'active' && (
                  <div className="flex flex-col gap-2 w-full md:w-52 justify-center">
                    <button 
                      onClick={() => { setSelectedComplaint(c); setAssignModalOpen(true); }} 
                      className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition shadow-sm"
                    >
                      <UserPlus className="w-4 h-4"/> {hasTechAssigned ? 'Reassign' : 'Assign Tech'}
                    </button>

                    {hasTechAssigned && (
                      <button 
                        onClick={() => openWhatsAppDispatch(c)} 
                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition shadow-sm"
                      >
                        <MessageCircle className="w-4 h-4" /> WhatsApp Tech
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Assign Modal */}
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
                  {technicians.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.full_name} ({t.trade || 'General'}) {t.phone_number ? `• 📞 ${t.phone_number}` : '• (No Phone)'}
                    </option>
                  ))}
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