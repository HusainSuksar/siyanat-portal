import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/useToast';
import { Wrench, UserPlus, X, ListFilter, History as HistoryIcon, MessageCircle, AlertCircle, MapPin, Calendar, FileText, XCircle, Printer } from 'lucide-react';
import { generateJobSheet } from '../../utils/printJobSheet';

const CAMPUS_ZONES = [
  'Main Jamea Complex',
  'Rabwat (Girls Hostel)',
  'Masakin (Boys Hostel)',
  'Mawaid',
  'Khaimat al-Riyadat'
];

export default function MaintenanceRouting({ userRole }: { userRole: string }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  
  const [viewMode, setViewMode] = useState<'active' | 'history' | 'print_slips'>('active');
  const [zoneFilter, setZoneFilter] = useState<string>('All');
  const [loading, setLoading] = useState(true);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Assign Modal States
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState<any>(null);
  const [selectedTechId, setSelectedTechId] = useState('');

  // Reject Modal States
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  // Print Slip Tab States
  const [printTechId, setPrintTechId] = useState('');

  const fetchMaintenance = async () => {
    setLoading(true);
    
    const targetStates = viewMode === 'history' 
      ? ['CLOSED', 'REJECTED'] 
      : ['SUBMITTED', 'AUTHORIZED', 'PROCESSING', 'ACTION_REQUIRED'];

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

  // Derived Zone Filter Data
  const availableZones = Array.from(new Set([...CAMPUS_ZONES, ...complaints.map(c => c.zone)])).filter(Boolean);
  const filteredComplaints = complaints.filter(c => zoneFilter === 'All' || c.zone === zoneFilter);
  const printComplaints = complaints.filter(c => c.assignments?.[0]?.technician?.id === printTechId && c.pipeline_state !== 'CLOSED' && c.pipeline_state !== 'REJECTED');

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

      if (selectedComplaint.pipeline_state === 'AUTHORIZED' || selectedComplaint.pipeline_state === 'SUBMITTED') {
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

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedComplaint || !rejectionReason.trim()) return;
    setProcessingId(selectedComplaint.id);

    try {
      const { error } = await supabase.from('complaints').update({ 
        pipeline_state: 'REJECTED',
        resolution_notes: 'Rejected by Ops: ' + rejectionReason 
      }).eq('id', selectedComplaint.id);
      
      if (error) throw error;

      if (selectedComplaint.requester_id) {
        await supabase.from('in_app_notifications').insert({
          user_id: selectedComplaint.requester_id,
          title: 'Maintenance Request Declined',
          message: `Your request (${selectedComplaint.complaint_id}) was declined. Reason: ${rejectionReason}`,
          is_read: false
        });
      }

      showToast("Complaint rejected successfully.", "success");
      setRejectModalOpen(false);
      setRejectionReason('');
      fetchMaintenance();
    } catch(err: any) {
      showToast("Rejection failed: " + err.message, "error");
    } finally {
      setProcessingId(null);
    }
  };

  const openWhatsAppDispatch = (complaint: any) => {
    const tech = complaint.assignments?.[0]?.technician;
    if (!tech?.phone_number) {
      alert("No phone number saved for this technician. Please update their profile.");
      return;
    }

    let cleanPhone = tech.phone_number.replace(/\D/g, '');
    if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;

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
      {/* Navigation Tabs */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-2 rounded-2xl border border-slate-200 shadow-sm w-full mb-4">
        <div className="flex flex-wrap gap-2 w-full">
          <button onClick={() => setViewMode('active')} className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition ${viewMode === 'active' ? 'bg-brand-maroon text-brand-gold shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}>
            <ListFilter className="w-4 h-4" /> Active Queue
          </button>
          <button onClick={() => setViewMode('print_slips')} className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition ${viewMode === 'print_slips' ? 'bg-emerald-700 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}>
            <Printer className="w-4 h-4" /> Print Job Sheets
          </button>
          <button onClick={() => setViewMode('history')} className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition ${viewMode === 'history' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}>
            <HistoryIcon className="w-4 h-4" /> History Log
          </button>
        </div>
      </div>

      {/* Zone-Based Filter Bar */}
      {viewMode !== 'print_slips' && availableZones.length > 0 && (
        <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
          <MapPin className="w-4 h-4 text-brand-maroon ml-2 shrink-0" />
          <select 
            value={zoneFilter} 
            onChange={(e) => setZoneFilter(e.target.value)} 
            className="flex-1 bg-transparent text-xs font-bold text-slate-700 outline-none uppercase tracking-wider cursor-pointer"
          >
            <option value="All">All Zones</option>
            {availableZones.map(z => <option key={z} value={z}>{z}</option>)}
          </select>
        </div>
      )}

      {/* Main Content Area */}
      {loading ? (
        <div className="p-8 text-center animate-pulse text-slate-500 font-bold bg-white rounded-3xl border border-slate-200">Loading complaints...</div>
      ) : viewMode === 'print_slips' ? (
        
        // --- PRINT SLIPS TAB ---
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-6">
          <div>
            <label className="block text-[11px] font-black text-slate-500 uppercase mb-2">Select Tradesman</label>
            <select value={printTechId} onChange={e => setPrintTechId(e.target.value)} className="w-full p-3.5 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 text-sm font-bold transition">
              <option value="">-- Choose a Technician to view their assigned tasks --</option>
              {technicians.map(t => (
                <option key={t.id} value={t.id}>{t.full_name} ({t.trade || 'General'})</option>
              ))}
            </select>
          </div>

          {printTechId && printComplaints.length > 0 ? (
            <div className="space-y-4 animate-in fade-in">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-t border-slate-100 pt-6">
                <div>
                  <h3 className="text-sm font-black text-slate-700 uppercase">Assigned Tasks ({printComplaints.length})</h3>
                  <p className="text-[10px] text-slate-400 font-bold mt-0.5">Tasks currently assigned to this technician.</p>
                </div>
                <button 
                  onClick={() => generateJobSheet(technicians.find(t => t.id === printTechId), printComplaints)}
                  className="w-full sm:w-auto py-3 px-5 bg-brand-maroon hover:bg-brand-dark text-white font-black rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition"
                >
                  <Printer className="w-4 h-4" /> Print Job Sheet
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {printComplaints.map(c => (
                  <div key={c.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                    <div className="font-black text-brand-maroon text-sm">{c.complaint_id}</div>
                    <div className="text-[10px] font-black uppercase text-slate-400 mt-1">{c.priority}</div>
                    <div className="text-xs font-bold text-slate-700 mt-1">{c.zone} • {c.venue}</div>
                    <div className="text-[10px] text-slate-500 mt-1 line-clamp-2" title={c.description}>{c.description}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : printTechId ? (
            <div className="text-center p-8 text-slate-400 font-bold uppercase text-xs border-2 border-dashed border-slate-200 rounded-2xl animate-in fade-in">
              No active tasks assigned to this technician.
            </div>
          ) : null}
        </div>

      ) : filteredComplaints.length === 0 ? (
        
        // --- EMPTY STATE ---
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 shadow-sm">
          <Wrench className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-bold uppercase tracking-wider text-xs">
            {viewMode === 'active' ? 'No maintenance tasks found for this zone.' : 'No historical records found.'}
          </p>
        </div>
      ) : (

        // --- ACTIVE / HISTORY QUEUE ---
        <div className="grid grid-cols-1 gap-4">
          {filteredComplaints.map(c => {
            const hasTechAssigned = c.assignments && c.assignments.length > 0;
            const tech = hasTechAssigned ? c.assignments[0].technician : null;
            const isEmergency = c.priority === 'Emergency';
            const isHigh = c.priority === 'High';

            return (
              <div key={c.id} className={`bg-white rounded-3xl p-5 shadow-sm border flex flex-col md:flex-row justify-between gap-5 transition hover:shadow-md ${c.pipeline_state === 'REJECTED' ? 'border-red-200' : 'border-slate-200'}`}>
                <div className="flex-1 space-y-3">
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
                        <span className="block font-black text-slate-800">{c.requester?.full_name || 'Anonymous'}</span>
                        <span className="text-[11px] text-slate-500 font-medium">{c.requester?.department || 'General'}</span>
                      </div>
                    </div>
                  </div>

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
                  
                  {hasTechAssigned && (
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-[10px] font-black text-indigo-700 uppercase tracking-wider bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-200 flex items-center gap-1">
                        {viewMode === 'history' ? 'Resolved By:' : 'Assigned Tradesman:'} <strong>{tech?.full_name}</strong> {tech?.phone_number ? `(📞 ${tech.phone_number})` : ''}
                      </span>
                    </div>
                  )}
                </div>

                {viewMode === 'active' && (
                  <div className="flex flex-col gap-2 w-full md:w-48 justify-center border-t md:border-t-0 md:border-l border-slate-100 pt-3 md:pt-0 md:pl-4">
                    <button 
                      onClick={() => { setSelectedComplaint(c); setAssignModalOpen(true); }} 
                      className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition shadow-sm"
                    >
                      <UserPlus className="w-3.5 h-3.5"/> {hasTechAssigned ? 'Reassign Tech' : 'Assign Tech'}
                    </button>

                    {!hasTechAssigned && (
                      <button 
                        onClick={() => { setSelectedComplaint(c); setRejectModalOpen(true); }} 
                        className="w-full py-3 bg-white hover:bg-red-50 text-red-600 font-black rounded-xl border border-red-200 text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition shadow-sm"
                      >
                        <XCircle className="w-3.5 h-3.5"/> Reject Request
                      </button>
                    )}

                    {hasTechAssigned && (
                      <button 
                        onClick={() => openWhatsAppDispatch(c)} 
                        className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition shadow-sm"
                      >
                        <MessageCircle className="w-3.5 h-3.5" /> WhatsApp Tech
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* --- ASSIGN MODAL --- */}
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

      {/* --- REJECT MODAL --- */}
      {rejectModalOpen && selectedComplaint && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="bg-red-600 p-5 flex justify-between text-white items-center">
              <h3 className="font-bold uppercase text-sm">Reject Maintenance Request</h3>
              <button onClick={() => setRejectModalOpen(false)} className="hover:text-red-200 transition"><X className="w-5 h-5"/></button>
            </div>
            <form onSubmit={handleRejectSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-[11px] font-black text-slate-500 uppercase mb-2">Reason for Rejection *</label>
                <textarea 
                  required 
                  value={rejectionReason} 
                  onChange={e => setRejectionReason(e.target.value)} 
                  placeholder="Explain why this request is being declined..."
                  className="w-full p-3.5 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-red-500 bg-slate-50 text-sm transition min-h-[100px]"
                />
              </div>
              <button type="submit" disabled={!!processingId} className="w-full py-3.5 bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase tracking-widest rounded-xl transition shadow-lg disabled:opacity-50">
                Confirm Rejection
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}