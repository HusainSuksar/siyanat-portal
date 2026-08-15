import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { RefreshCw, MessageSquare, Truck, UserPlus, X, SplitSquareHorizontal, Archive, Trash2 } from 'lucide-react';
import BatchDetailsModal from '../components/BatchDetailsModal';

export default function SiyanatOperations() {
  const [activeTab, setActiveTab] = useState<'materials' | 'maintenance'>('materials');
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  
  // Material State
  const [batches, setBatches] = useState<any[]>([]);
  const [activeBatch, setActiveBatch] = useState<any>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  
  // Batch Splitting Modal State
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewBatch, setReviewBatch] = useState<any>(null);
  const [itemDecisions, setItemDecisions] = useState<any>({});

  // Maintenance State
  const [complaints, setComplaints] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState<any>(null);
  const [selectedTechId, setSelectedTechId] = useState('');

  // UseCallback ensures this function is perfectly stable for useEffect
  const fetchData = useCallback(async () => {
    setLoading(true);
    
    try {
      // 1. Fetch Materials (Force fresh read)
      const { data: batchData, error: batchError } = await supabase
        .from('work_orders')
        .select(`*, logs:work_order_logs(author_id), items:work_order_items(id, requested_qty, item_type, custom_item_name, status, eta_days, inventory_id, inventory:inventory_items(id, name, physical_stock, freezed_stock))`)
        .order('created_at', { ascending: false });

      if (batchError) throw batchError;
      if (batchData) setBatches(batchData);

      // 2. Fetch Maintenance (Force fresh read, explicit status array)
      const { data: complaintData, error: complaintError } = await supabase
        .from('complaints')
        .select(`
          *, 
          requester:profiles(full_name, department), 
          assignments:technician_assignments(status, technician:profiles(full_name, trade))
        `)
        .in('status', [
          'Approved by Supervisor', 
          'Assigned', 
          'Waiting for Material', 
          'Completed', 
          'Verified', 
          'Complaint Reopened'
        ])
        .order('created_at', { ascending: false });

      if (complaintError) throw complaintError;
      if (complaintData) setComplaints(complaintData);

      // 3. Fetch Technicians
      const { data: techData } = await supabase
        .from('profiles')
        .select('id, full_name, trade')
        .eq('role', 'TECHNICIAN');
        
      if (techData) setTechnicians(techData);

    } catch (err: any) {
      console.error("Error fetching Siyanat Operations data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    supabase.auth.getUser().then(({ data }) => setCurrentUser(data.user));
  }, [fetchData, activeTab]); // Re-fetch whenever the tab changes to guarantee fresh data

  // --- MATERIAL LOGIC ---
  const openReviewModal = (batch: any) => {
    setReviewBatch(batch);
    const initialDecisions: any = {};
    batch.items.forEach((item: any) => {
      initialDecisions[item.id] = { status: 'Available', eta: 0 };
    });
    setItemDecisions(initialDecisions);
    setReviewModalOpen(true);
  };

  const updateDecision = (itemId: string, field: string, value: any) => {
    setItemDecisions((prev: any) => ({
      ...prev,
      [itemId]: { ...prev[itemId], [field]: value }
    }));
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessingId(reviewBatch.id);

    try {
      let hasAvailableItems = false;
      for (const item of reviewBatch.items) {
        const decision = itemDecisions[item.id];
        await supabase.from('work_order_items').update({ status: decision.status, eta_days: decision.eta }).eq('id', item.id);

        if (decision.status === 'Available' && item.item_type === 'Catalog' && item.inventory_id) {
          const inv = item.inventory;
          const newFreezedStock = (inv.freezed_stock || 0) + item.requested_qty;
          await supabase.from('inventory_items').update({ freezed_stock: newFreezedStock }).eq('id', item.inventory_id);
          hasAvailableItems = true;
        }
      }

      await supabase.from('work_orders').update({
        approval_status: 'Approved',
        dispatch_status: hasAvailableItems ? 'Pending' : 'Awaiting Stock'
      }).eq('id', reviewBatch.id);

      await supabase.from('system_logs').insert({
        action_type: 'BATCH_REVIEWED',
        description: `Split and processed material batch ${reviewBatch.batch_id}. Frozen available stock.`,
        user_email: currentUser?.email || 'Admin'
      });

      alert('Batch processed and stock frozen successfully!');
      setReviewModalOpen(false);
      fetchData();
    } catch (err: any) {
      alert("Error processing batch: " + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const dispatchBatch = async (batch: any) => {
    if (!confirm('Dispatch available items? Stock will remain frozen until the requester confirms receipt.')) return;
    setProcessingId(batch.id);
    
    try {
      await supabase.from('work_orders').update({ dispatch_status: 'Dispatched' }).eq('id', batch.id);
      await supabase.from('system_logs').insert({
        action_type: 'STOCK_DISPATCHED',
        description: `Dispatched ${batch.batch_id} to location. Stock remains frozen pending receipt.`,
        user_email: currentUser?.email || 'Admin'
      });
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
    setProcessingId(null);
  };

  // 🔴 GOD MODE: Delete Material Batch
  const deleteBatch = async (id: string, batchId: string) => {
    if (!confirm(`GOD MODE WARNING: Are you sure you want to completely eradicate Batch ${batchId}? This is irreversible.`)) return;
    setProcessingId(id);
    await supabase.from('work_orders').delete().eq('id', id);
    await supabase.from('system_logs').insert({
      action_type: 'GOD_MODE_DELETE',
      description: `Admin hard-deleted material batch ${batchId}.`,
      user_email: currentUser?.email || 'Admin'
    });
    fetchData();
    setProcessingId(null);
  };

  // --- MAINTENANCE LOGIC ---
  const handleAssignTechnician = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTechId || !selectedComplaint) return;
    setProcessingId(selectedComplaint.id);

    try {
      await supabase.from('technician_assignments').insert({
        complaint_id: selectedComplaint.id,
        technician_id: selectedTechId,
        assigned_by: currentUser?.id
      });
      
      await supabase.from('complaints').update({ status: 'Assigned' }).eq('id', selectedComplaint.id);
      
      await supabase.from('system_logs').insert({
        action_type: 'TECHNICIAN_ASSIGNED',
        description: `Assigned complaint ${selectedComplaint.complaint_id} to technician.`,
        user_email: currentUser?.email || 'Admin'
      });

      setAssignModalOpen(false);
      setSelectedTechId('');
      fetchData();
    } catch(err: any) {
       alert("Error assigning technician: " + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  // 🟢 NEW: Close Verified Complaint
  const closeComplaint = async (id: string, complaintId: string) => {
    if (!confirm(`Officially close complaint ${complaintId}?`)) return;
    setProcessingId(id);
    
    await supabase.from('complaints').update({ status: 'Closed' }).eq('id', id);
    await supabase.from('system_logs').insert({
      action_type: 'COMPLAINT_CLOSED',
      description: `Admin officially closed verified complaint ${complaintId}.`,
      user_email: currentUser?.email || 'Admin'
    });
    
    fetchData();
    setProcessingId(null);
  };

  // 🔴 GOD MODE: Delete Complaint
  const deleteComplaint = async (id: string, complaintId: string) => {
    if (!confirm(`GOD MODE WARNING: Are you sure you want to completely eradicate Complaint ${complaintId}? All associated photos and assignments will be destroyed.`)) return;
    setProcessingId(id);
    await supabase.from('complaints').delete().eq('id', id);
    await supabase.from('system_logs').insert({
      action_type: 'GOD_MODE_DELETE',
      description: `Admin hard-deleted maintenance complaint ${complaintId}.`,
      user_email: currentUser?.email || 'Admin'
    });
    fetchData();
    setProcessingId(null);
  };

  return (
    <div className="space-y-6 pb-24">
      {/* Header & Tabs */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-brand-maroon flex items-center gap-2">
            <Truck className="w-6 h-6" />
            Siyanat Operations Control
          </h2>
          <p className="text-xs text-slate-500 mt-1">Manage material dispatches, maintenance routing, and portal overrides.</p>
        </div>
        <button onClick={fetchData} className="text-xs text-brand-maroon font-bold flex items-center space-x-1 hover:text-brand-dark">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Data</span>
        </button>
      </div>

      <div className="flex space-x-2 border-b border-slate-200">
        <button 
          onClick={() => setActiveTab('materials')}
          className={`px-4 py-2 text-sm font-bold border-b-2 transition ${activeTab === 'materials' ? 'border-brand-maroon text-brand-maroon' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          Material Dispatch
        </button>
        <button 
          onClick={() => setActiveTab('maintenance')}
          className={`px-4 py-2 text-sm font-bold border-b-2 transition ${activeTab === 'maintenance' ? 'border-brand-maroon text-brand-maroon' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          Maintenance Routing
        </button>
      </div>

      {/* --- TAB 1: MATERIAL DISPATCH --- */}
      {activeTab === 'materials' && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 uppercase font-bold">
              <tr>
                <th className="p-3">Batch ID</th>
                <th className="p-3">Department</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (<tr><td colSpan={4} className="p-4 text-center">Loading...</td></tr>) : batches.length === 0 ? (<tr><td colSpan={4} className="p-4 text-center">No active batches.</td></tr>) : batches.map(b => (
                <tr key={b.id} className="hover:bg-slate-50">
                  <td className="p-3 font-bold text-brand-maroon">{b.batch_id}</td>
                  <td className="p-3 font-semibold">{b.department}<div className="text-[10px] text-slate-500">{b.location}</div></td>
                  <td className="p-3">
                    <div className="flex flex-col gap-1 items-start">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${b.approval_status === 'Approved' ? 'bg-emerald-100 text-emerald-800' : b.approval_status === 'Rejected' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>{b.approval_status}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">{b.dispatch_status}</span>
                    </div>
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {b.approval_status === 'Pending Approval' && (
                        <button 
                          onClick={() => openReviewModal(b)} 
                          className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[11px] shadow-sm flex items-center"
                        >
                          <SplitSquareHorizontal className="w-3 h-3 mr-1"/> Split
                        </button>
                      )}
                      {b.approval_status === 'Approved' && b.dispatch_status === 'Pending' && (
                        <button 
                          onClick={() => dispatchBatch(b)} 
                          disabled={processingId === b.id}
                          className="px-2.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-lg text-[11px] shadow-sm flex items-center disabled:opacity-50"
                        >
                          <Truck className="w-3 h-3 mr-1"/> Dispatch
                        </button>
                      )}
                      <button onClick={() => { setActiveBatch(b); setIsChatOpen(true); }} className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-[11px] flex items-center"><MessageSquare className="w-3 h-3 mr-1"/>Chat</button>
                      
                      {/* GOD MODE: Delete */}
                      <button onClick={() => deleteBatch(b.id, b.batch_id)} disabled={processingId === b.id} className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition disabled:opacity-50" title="Delete Batch">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* --- TAB 2: MAINTENANCE ROUTING --- */}
      {activeTab === 'maintenance' && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 uppercase font-bold">
              <tr>
                <th className="p-3">Complaint ID</th>
                <th className="p-3">Location & Issue</th>
                <th className="p-3">Current Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (<tr><td colSpan={4} className="p-4 text-center">Loading...</td></tr>) : complaints.length === 0 ? (<tr><td colSpan={4} className="p-4 text-center">No maintenance tasks pending assignment or closure.</td></tr>) : complaints.map(c => {
                const isAssigned = c.assignments && c.assignments.length > 0;
                return (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="p-3 font-bold text-brand-maroon">{c.complaint_id}<div className="text-[10px] text-slate-500 mt-0.5">{c.requester?.full_name}</div></td>
                    <td className="p-3"><div className="font-semibold">{c.category}</div><div className="text-[10px] text-slate-600">{c.zone} - {c.venue}</div></td>
                    <td className="p-3">
                      <div className="flex flex-col gap-1 items-start">
                        <span className={`px-2 py-0.5 text-slate-800 rounded font-bold text-[10px] ${c.status === 'Verified' ? 'bg-emerald-200 text-emerald-900' : 'bg-slate-200'}`}>{c.status}</span>
                        {isAssigned && <span className="text-[9px] font-bold text-indigo-600 uppercase">Tech: {c.assignments[0].technician.full_name}</span>}
                      </div>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {c.status === 'Approved by Supervisor' && (
                          <button onClick={() => { setSelectedComplaint(c); setAssignModalOpen(true); }} className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-[11px] shadow-sm flex items-center gap-1"><UserPlus className="w-3 h-3" /> Assign</button>
                        )}
                        
                        {/* THE MISSING CLOSE WORKFLOW */}
                        {c.status === 'Verified' && (
                          <button onClick={() => closeComplaint(c.id, c.complaint_id)} disabled={processingId === c.id} className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[11px] shadow-sm flex items-center gap-1 disabled:opacity-50">
                            <Archive className="w-3 h-3" /> Close
                          </button>
                        )}

                        {/* GOD MODE: Delete */}
                        <button onClick={() => deleteComplaint(c.id, c.complaint_id)} disabled={processingId === c.id} className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition disabled:opacity-50" title="Delete Complaint">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* --- BATCH REVIEW & SPLIT MODAL --- */}
      {reviewModalOpen && reviewBatch && (
        <div className="fixed inset-0 bg-black/50 z-50 flex justify-center items-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden">
            <div className="bg-brand-maroon p-4 flex justify-between items-center text-white">
              <h3 className="font-extrabold text-sm uppercase">Review & Split Batch: {reviewBatch.batch_id}</h3>
              <button onClick={() => setReviewModalOpen(false)}><X className="w-5 h-5 hover:text-red-300" /></button>
            </div>
            <form onSubmit={handleReviewSubmit} className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <p className="text-xs text-slate-500 font-bold mb-4">Determine availability for each requested item. Available items will be frozen in inventory.</p>
              
              {reviewBatch.items.map((item: any) => {
                const itemName = item.item_type === 'Catalog' && item.inventory ? item.inventory.name : item.custom_item_name;
                const physicalStock = item.inventory?.physical_stock || 0;
                const frozenStock = item.inventory?.freezed_stock || 0;
                const availableStock = Math.max(0, physicalStock - frozenStock);
                
                return (
                  <div key={item.id} className="p-3 border border-slate-200 rounded-xl bg-slate-50 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                    <div className="md:col-span-4">
                      <div className="font-bold text-slate-800 text-xs">{itemName}</div>
                      <div className="text-[10px] text-slate-500">Requested: <span className="font-bold text-brand-maroon">{item.requested_qty}</span></div>
                      {item.item_type === 'Catalog' && (
                        <div className="text-[10px] text-emerald-600 font-bold mt-1">Avail Stock: {availableStock}</div>
                      )}
                    </div>
                    
                    <div className="md:col-span-5">
                      <select 
                        value={itemDecisions[item.id]?.status || 'Available'}
                        onChange={(e) => updateDecision(item.id, 'status', e.target.value)}
                        className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-brand-maroon"
                      >
                        <option value="Available">Available (Freeze Stock)</option>
                        <option value="Pending">Pending (Requires ETA)</option>
                        <option value="Not Provided">Not Provided (Reject)</option>
                      </select>
                    </div>

                    <div className="md:col-span-3">
                      {itemDecisions[item.id]?.status === 'Pending' && (
                        <div>
                          <label className="block text-[9px] font-bold text-slate-500 uppercase">ETA (Days)</label>
                          <input 
                            type="number" 
                            min="1" 
                            required
                            value={itemDecisions[item.id]?.eta || ''}
                            onChange={(e) => updateDecision(item.id, 'eta', parseInt(e.target.value) || 0)}
                            className="w-full p-1.5 bg-white border border-slate-300 rounded text-xs font-bold outline-none text-center focus:ring-2 focus:ring-amber-500"
                            placeholder="e.g. 5"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              <button 
                type="submit" 
                disabled={processingId === reviewBatch.id}
                className="w-full py-3 mt-4 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase rounded-xl shadow-md transition disabled:opacity-50"
              >
                Confirm Split & Freeze Stock
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- MAINTENANCE ASSIGN MODAL --- */}
      {assignModalOpen && selectedComplaint && (
        <div className="fixed inset-0 bg-black/50 z-50 flex justify-center items-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="bg-brand-maroon p-4 flex justify-between items-center text-white">
              <h3 className="font-extrabold text-sm uppercase">Assign Technician</h3>
              <button onClick={() => setAssignModalOpen(false)}><X className="w-5 h-5 hover:text-red-300" /></button>
            </div>
            <form onSubmit={handleAssignTechnician} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Select Tradesman *</label>
                <select required value={selectedTechId} onChange={e => setSelectedTechId(e.target.value)} className="w-full p-2.5 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-maroon">
                  <option value="" disabled>-- Choose Tradesman --</option>
                  {technicians.map(t => <option key={t.id} value={t.id}>{t.full_name} ({t.trade || 'General'})</option>)}
                </select>
              </div>
              <button type="submit" disabled={processingId === selectedComplaint.id} className="w-full py-3 mt-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs uppercase rounded-xl disabled:opacity-50">Dispatch</button>
            </form>
          </div>
        </div>
      )}

      {/* Chat Modal */}
      {activeBatch && currentUser && (
        <BatchDetailsModal batchId={activeBatch.batch_id} workOrderId={activeBatch.id} isOpen={isChatOpen} onClose={() => { setIsChatOpen(false); setActiveBatch(null); }} currentUser={currentUser} />
      )}
    </div>
  );
}