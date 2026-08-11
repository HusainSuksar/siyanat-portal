import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Wrench, Printer, CheckCircle, Clock, MapPin, AlertCircle } from 'lucide-react';

export default function TechnicianPortal() {
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);

  const fetchAssignments = async () => {
    setLoading(true);
    const { data: authData } = await supabase.auth.getUser();
    
    if (authData.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .single();
      
      setUserProfile(profile);

      const { data, error } = await supabase
        .from('technician_assignments')
        .select(`
          *,
          complaint:complaints(*)
        `)
        .eq('technician_id', authData.user.id)
        .order('assigned_at', { ascending: false });

      if (data && !error) setAssignments(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAssignments();
  }, []);

  const updateTaskStatus = async (assignmentId: string, complaintId: string, newStatus: string) => {
    if (!confirm(`Mark this task as ${newStatus}?`)) return;

    // Update assignment status
    await supabase
      .from('technician_assignments')
      .update({ status: newStatus })
      .eq('id', assignmentId);

    // Sync master complaint status
    await supabase
      .from('complaints')
      .update({ status: newStatus })
      .eq('id', complaintId);

    fetchAssignments();
  };

  const printWorkloadSlip = () => {
    const tasksHtml = assignments.map((a, idx) => `
      <div style="border: 1px solid #000; padding: 15px; margin-bottom: 15px;">
        <h4 style="margin: 0 0 10px 0; border-bottom: 1px solid #ccc; padding-bottom: 5px;">
          TASK ${idx + 1} | ${a.complaint.complaint_id} 
          <span style="float: right;">${a.complaint.priority}</span>
        </h4>
        <p><strong>Category:</strong> ${a.complaint.category}</p>
        <p><strong>Location:</strong> ${a.complaint.zone} - ${a.complaint.venue} (${a.complaint.floor}, ${a.complaint.room_area})</p>
        <p><strong>Description:</strong> ${a.complaint.description}</p>
        <p><strong>Status:</strong> ${a.status}</p>
      </div>
    `).join("");

    const slipWindow = window.open('', '_blank');
    if (!slipWindow) return;

    slipWindow.document.write(`
      <html>
        <head>
          <title>Workload Slip - ${userProfile?.full_name}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; color: #000; max-width: 800px; margin: 0 auto; }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
          </style>
        </head>
        <body onload="window.print();">
          <div class="header">
            <h2 style="margin: 0; color: #581c28;">SIYANAT UL MUMTALEKAAT</h2>
            <h3 style="margin: 5px 0;">TECHNICIAN WORKLOAD SLIP</h3>
          </div>
          <p><strong>Technician:</strong> ${userProfile?.full_name}</p>
          <p><strong>Trade:</strong> ${userProfile?.trade || 'General'}</p>
          <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
          <p><strong>Total Assigned Tasks:</strong> ${assignments.length}</p>
          <div style="margin-top: 20px;">
            ${tasksHtml}
          </div>
        </body>
      </html>
    `);
    slipWindow.document.close();
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-24">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-brand-maroon p-6 rounded-2xl text-white shadow-lg">
        <div>
          <h2 className="text-xl font-extrabold flex items-center gap-2 text-brand-gold">
            <Wrench className="w-6 h-6" />
            My Workload
          </h2>
          <p className="text-xs text-brand-gold/80 mt-1">Technician: {userProfile?.full_name}</p>
        </div>
        <button 
          onClick={printWorkloadSlip}
          disabled={assignments.length === 0}
          className="px-4 py-2 bg-brand-gold hover:bg-amber-500 text-brand-dark font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition flex items-center space-x-2 disabled:opacity-50"
        >
          <Printer className="w-4 h-4" />
          <span>Print Workload Slip</span>
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 text-center">
          <div className="text-2xl font-black text-slate-800">{assignments.length}</div>
          <div className="text-[10px] font-bold text-slate-500 uppercase mt-1">Total Tasks</div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 text-center">
          <div className="text-2xl font-black text-red-600">
            {assignments.filter(a => a.complaint.priority.includes('URGENT')).length}
          </div>
          <div className="text-[10px] font-bold text-slate-500 uppercase mt-1">Urgent</div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 text-center">
          <div className="text-2xl font-black text-emerald-600">
            {assignments.filter(a => a.status === 'Completed').length}
          </div>
          <div className="text-[10px] font-bold text-slate-500 uppercase mt-1">Completed</div>
        </div>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-10 text-slate-500 font-bold animate-pulse">Loading assignments...</div>
        ) : assignments.length === 0 ? (
          <div className="text-center py-10 bg-white rounded-2xl border border-slate-200 text-slate-500 font-bold">No active tasks assigned.</div>
        ) : (
          assignments.map(a => {
            const isUrgent = a.complaint.priority.includes('URGENT');
            const isCompleted = a.status === 'Completed';

            return (
              <div key={a.id} className={`bg-white rounded-2xl p-5 shadow-sm border-l-4 ${isUrgent ? 'border-l-red-500' : 'border-l-slate-300'} border-y border-r border-slate-200`}>
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <span className="text-xs font-black text-brand-maroon">{a.complaint.complaint_id}</span>
                    <h3 className="font-extrabold text-slate-800 text-sm mt-1">{a.complaint.category}</h3>
                  </div>
                  <span className={`px-2 py-1 rounded text-[10px] font-bold ${
                    isCompleted ? 'bg-emerald-100 text-emerald-800' : 
                    a.status === 'Waiting for Material' ? 'bg-amber-100 text-amber-800' : 
                    'bg-indigo-100 text-indigo-800'
                  }`}>
                    {a.status}
                  </span>
                </div>

                <div className="space-y-2 mb-4 text-xs">
                  <div className="flex items-start gap-2 text-slate-600">
                    <MapPin className="w-4 h-4 shrink-0 text-slate-400" />
                    <span className="font-medium">{a.complaint.zone} - {a.complaint.venue} ({a.complaint.floor}, {a.complaint.room_area})</span>
                  </div>
                  <div className="flex items-start gap-2 text-slate-600">
                    <AlertCircle className="w-4 h-4 shrink-0 text-slate-400" />
                    <span className="font-medium line-clamp-2">{a.complaint.description}</span>
                  </div>
                </div>

                {!isCompleted && (
                  <div className="flex gap-2 pt-4 border-t border-slate-100">
                    <button 
                      onClick={() => updateTaskStatus(a.id, a.complaint_id, 'Completed')}
                      className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-lg shadow-sm transition flex justify-center items-center gap-1"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      Complete Task
                    </button>
                    <button 
                      onClick={() => updateTaskStatus(a.id, a.complaint_id, 'Waiting for Material')}
                      className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-[11px] rounded-lg shadow-sm transition flex justify-center items-center gap-1"
                    >
                      <Clock className="w-3.5 h-3.5" />
                      Wait for Material
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}