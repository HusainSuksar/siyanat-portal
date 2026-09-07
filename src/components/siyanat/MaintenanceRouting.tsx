import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/useToast';
import { Wrench, UserPlus, X, ListFilter, History as HistoryIcon, MessageCircle, AlertCircle, MapPin, Calendar, FileText } from 'lucide-react';

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

            // Color badge based on priority
            const isEmergency = c.priority === 'Emergency';
            const isHigh = c.priority === 'High';

            return (
              <div key={c.id} className={`bg-white rounded-3xl p-5 shadow-sm border flex flex-col md:flex-row justify-between gap-5 transition hover:shadow-md ${c.pipeline_state === 'REJECTED' ? 'border-red-200' : 'border-slate-200'}`}>
                <div className="flex-1 space-y-3">
                  
                  {/* Header Row: ID, Badges & Reported Date */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-brand-maroon text-lg tracking-tight">{c.complaint_id}</h3>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${
                        isEmergency ? 'bg-red-100 text-red-700 border border-red-200' :
                        isHigh ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        <AlertCircle className="w-3 h-3" /> {c.priority || 'Normal'}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 uppercase">
                        {c.category}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-[11px] font-bold text-slate-400">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(c.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </div>
                  </div>

                  {/* Location & Requester Metadata */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="flex items-start gap-1.5 text-slate-700 font-semibold bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <MapPin className="w-4 h-4 text-brand-maroon shrink-0 mt-0.5" />
                      <div>
                        <span className="block font-black text-slate-800">{c.zone} • {c.venue}</span>
                        {(c.floor || c.room_area) && (
                          <span className="text-[11px] text-slate-500 font-medium">
                            {c.floor && c.floor !== 'N/A' ? c.floor : ''} {c.room_area && c.room_area !== 'N/A' ? `(${c.room_area})` : ''}
                          </span>
                        )}
                        {c.student_tr_no && (
                          <span className="text-[10px] block font-black text-brand-maroon">TR No: {c.student_tr_no}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-start gap-1.5 text-slate-700 font-semibold bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <div className="w-4 h-4 rounded-full bg-brand-maroon text-white flex items-center justify-center text-[9px] font-black shrink-0 mt-0.5">
                        👤
                      </div>
                      <div>
                        <span className="block font-black text-slate-800">{c.requester?.full_name || 'Anonymous Submitter'}</span>
                        <span className="text-[11px] text-slate-500 font-medium">{c.requester?.department || 'General'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Full Issue Description */}
                  {c.description && (
                    <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-100">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1 flex items-center gap-1">
                        <FileText className="w-3 h-3" /> Issue Description:
                      </span>
                      <p className="text-xs text-slate-700 font-medium leading-relaxed whitespace-pre-wrap">
                        {c.description}
                      </p>
                    </div>
                  )}
                  
                  {/* Assigned Technician Tag */}
                  {hasTechAssigned && (
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-[10px] font-black text-indigo-700 uppercase tracking-wider bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-200 flex items-center gap-1">
                        {viewMode === 'history' ? 'Resolved By:' : 'Assigned Tradesman:'} <strong>{tech?.full_name}</strong> {tech?.phone_number ? `(📞 ${tech.phone_number})` : ''}
                      </span>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                {viewMode === 'active' && (
                  <div className="flex flex-col gap-2 w-full md:w-48 justify-center border-t md:border-t-0 md:border-l border-slate-100 pt-3 md:pt-0 md:pl-4">
                    <button 
                      onClick={() => { setSelectedComplaint(c); setAssignModalOpen(true); }} 
                      className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition shadow-sm"
                    >
                      <UserPlus className="w-4 h-4"/> {hasTechAssigned ? 'Reassign Tech' : 'Assign Tech'}
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