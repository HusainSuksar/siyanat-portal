import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/useToast';
import { Package, SplitSquareHorizontal, CheckCircle, ShoppingCart, MessageSquare, Trash2, X, ListFilter, History as HistoryIcon } from 'lucide-react';
import type { WorkOrder } from '../../types';
import VendorPOEngine from './VendorPOEngine';
import BatchDetailsModal from '../BatchDetailsModal';

export default function MaterialDispatch({ userRole }: { userRole: string }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  
  // THE NEW FEATURE: Toggle between Active Queue and History Archive
  const [viewMode, setViewMode] = useState<'active' | 'history'>('active');
  const [loading, setLoading] = useState(true);
  const [batches, setBatches] = useState<WorkOrder[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Modal States
  const [reviewBatch, setReviewBatch] = useState<WorkOrder | null>(null);
  const [itemDecisions, setItemDecisions] = useState<Record<string, { status: string; eta: number }>>({});
  const [poBatch, setPoBatch] = useState<WorkOrder | null>(null);
  const [chatBatch, setChatBatch] = useState<WorkOrder | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WorkOrder | null>(null);

  const fetchMaterials = async () => {
    setLoading(true);
    
    const targetStates = viewMode === 'active' 
      ? ['AUTHORIZED', 'PROCESSING'] 
      : ['ACTION_REQUIRED', 'CLOSED', 'REJECTED'];

    const { data, error } = await supabase
      .from('work_orders')
      .select(`*, requester:profiles(full_name, department), items:work_order_items!inner(id, requested_qty, item_type, custom_item_name, status, eta_days, fulfillment_dept, inventory_id, inventory:inventory_items(id, name, physical_stock, freezed_stock))`)
      .in('pipeline_state', targetStates)
      .order('created_at', { ascending: false });

    if (!error && data) {
      const filtered = data.filter(b => userRole === 'SUPER_ADMIN' || userRole === 'ADMIN' || b.items.some((i: any) => i.fulfillment_dept === userRole));
      setBatches(filtered as WorkOrder[]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchMaterials(); }, [userRole, viewMode]);

  const openReviewModal = (batch: WorkOrder) => {
    setReviewBatch(batch);
    const initial: any = {};
    batch.items.filter(i => userRole === 'SUPER_ADMIN' || i.fulfillment_dept === userRole).forEach(item => {
      initial[item.id] = { status: item.status === 'Pending' ? 'Available' : item.status, eta: item.eta_days || 0 };
    });
    setItemDecisions(initial);
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewBatch) return;
    setProcessingId(reviewBatch.id);

    try {
      const payload = Object.entries(itemDecisions).map(([id, dec]) => ({ item_id: id, status: dec.status, eta: dec.eta }));
      const { error } = await supabase.rpc('process_material_batch_json', {
        p_batch_id: reviewBatch.id,
        p_decisions: payload,
        p_user_email: user?.email || 'Admin'
      });
      if (error) throw error;

      showToast("Batch items processed securely!", "success");
      setReviewBatch(null);
      fetchMaterials();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setProcessingId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setProcessingId(deleteTarget.id);
    await supabase.from('work_orders').delete().eq('id', deleteTarget.id);
    showToast("Batch eradicated.", "success");
    setDeleteTarget(null);
    fetchMaterials();
    setProcessingId(null);
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
        <div className="p-8 text-center animate-pulse text-slate-500 font-bold bg-white rounded-3xl border border-slate-200">Loading materials...</div>
      ) : batches.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 shadow-sm">
          <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-bold uppercase tracking-wider text-xs">
            {viewMode === 'active' ? 'No active material batches.' : 'No historical records found.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {batches.map(b => {
            const isTechPO = b.department === 'Technician Procurement';
            const myItems = b.items.filter(i => userRole === 'SUPER_ADMIN' || i.fulfillment_dept === userRole);
            const needsReview = myItems.some(i => i.status === 'Pending');

            return (
              <div key={b.id} className={`bg-white rounded-3xl p-5 shadow-sm border flex flex-col md:flex-row justify-between gap-5 transition hover:shadow-md ${b.pipeline_state === 'REJECTED' ? 'border-red-200' : 'border-slate-200'}`}>
                <div className="space-y-3 flex-1 w-full">
                  <div className="flex items-center justify-between">
                    <h3 className="font-black text-brand-maroon text-lg">Batch: {b.batch_id}</h3>
                    
                    {/* Dynamic Status Badges depending on view mode */}
                    {viewMode === 'active' ? (
                      <span className={`px-2 py-0.5 text-[9px] font-black uppercase rounded ${b.pipeline_state === 'PROCESSING' ? 'bg-indigo-100 text-indigo-800' : 'bg-amber-100 text-amber-800'}`}>
                        {b.pipeline_state === 'PROCESSING' ? 'Waiting on other Depts' : 'Awaiting Dispatch'}
                      </span>
                    ) : (
                      <span className={`px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest rounded ${b.pipeline_state === 'REJECTED' ? 'bg-red-100 text-red-600' : b.pipeline_state === 'CLOSED' ? 'bg-slate-200 text-slate-600' : 'bg-emerald-100 text-emerald-800'}`}>
                        {b.pipeline_state === 'REJECTED' ? 'Rejected' : b.pipeline_state === 'CLOSED' ? 'Picked Up' : 'Awaiting Pickup'}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 font-bold uppercase tracking-wider">{b.requester?.full_name} • {b.location}</p>
                  
                  {/* Detailed Items View */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 mt-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Items Processed by {userRole.replace('_HEAD', '')}:</span>
                    <div className="space-y-1">
                      {myItems.map((item) => (
                        <div key={item.id} className="text-xs font-bold text-slate-700 flex justify-between items-center py-1">
                          <span>{item.inventory?.name || item.custom_item_name}</span>
                          
                          {/* Show finalized status in history view */}
                          {viewMode === 'history' ? (
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${item.status === 'Available' ? 'bg-emerald-100 text-emerald-700' : item.status === 'Not Provided' ? 'bg-red-100 text-red-600' : 'bg-indigo-100 text-indigo-700'}`}>
                              {item.status} (Qty: {item.requested_qty})
                            </span>
                          ) : (
                            <span className="text-brand-maroon font-black">Qty: {item.requested_qty}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 flex-wrap md:flex-col md:w-48 justify-center border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-5">
                  {/* Action Buttons (Only visible in Active mode, except Chat/Delete) */}
                  {viewMode === 'active' && (
                    <>
                      {isTechPO ? (
                        <button onClick={() => setPoBatch(b)} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-wider rounded-xl text-[10px] flex items-center justify-center gap-1.5 shadow-sm transition"><ShoppingCart className="w-4 h-4"/> Gen PO</button>
                      ) : needsReview ? (
                        <button onClick={() => openReviewModal(b)} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-wider rounded-xl text-[10px] flex items-center justify-center gap-1.5 shadow-sm transition"><SplitSquareHorizontal className="w-4 h-4"/> Split/Dispatch</button>
                      ) : (
                        <div className="w-full py-3 bg-slate-100 text-slate-500 font-black uppercase tracking-wider rounded-xl text-[10px] flex items-center justify-center gap-1.5 border border-slate-200"><CheckCircle className="w-4 h-4"/> Reviewed</div>
                      )}
                    </>
                  )}
                  
                  <button onClick={() => setChatBatch(b)} className="w-full py-3 bg-slate-800 hover:bg-slate-900 text-white font-black uppercase tracking-wider rounded-xl text-[10px] flex items-center justify-center gap-1.5 shadow-sm transition"><MessageSquare className="w-4 h-4"/> Thread</button>
                  
                  {userRole === 'SUPER_ADMIN' && viewMode === 'active' && (
                    <button onClick={() => setDeleteTarget(b)} className="w-full py-3 bg-white hover:bg-red-50 text-red-600 font-black uppercase tracking-wider rounded-xl border border-red-200 text-[10px] flex items-center justify-center shadow-sm transition"><Trash2 className="w-4 h-4"/></button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Child Modals */}
      {poBatch && user && <VendorPOEngine batch={poBatch} userEmail={user.email || ''} onClose={() => setPoBatch(null)} onSuccess={() => { setPoBatch(null); fetchMaterials(); }} />}
      {chatBatch && user && <BatchDetailsModal batchId={chatBatch.batch_id} workOrderId={chatBatch.id} isOpen={!!chatBatch} onClose={() => setChatBatch(null)} currentUser={user} />}
      
      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-3xl max-w-sm w-full text-center shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-black text-slate-800 mb-2 uppercase">Eradicate Batch?</h3>
            <p className="text-xs text-slate-500 font-bold mb-6">This action is permanent and cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs uppercase tracking-widest rounded-xl transition">Cancel</button>
              <button onClick={confirmDelete} disabled={processingId === deleteTarget.id} className="flex-1 py-3.5 bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase tracking-widest rounded-xl transition shadow-lg disabled:opacity-50">Confirm Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {reviewBatch && (
         <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
           <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
             <div className="bg-brand-maroon p-5 flex justify-between items-center text-white">
               <h3 className="font-extrabold text-sm uppercase">Review Batch</h3>
               <button onClick={() => setReviewBatch(null)} className="hover:text-red-200 transition"><X className="w-5 h-5"/></button>
             </div>
             <form onSubmit={handleReviewSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
               {reviewBatch.items.map(item => (
                 <div key={item.id} className="p-4 border border-slate-200 rounded-2xl grid grid-cols-1 md:grid-cols-12 gap-4 items-center bg-slate-50 shadow-sm">
                    <div className="md:col-span-5">
                      <div className="font-bold text-slate-800 text-sm">{item.custom_item_name || item.inventory?.name}</div>
                      <div className="text-[11px] text-slate-500 font-medium">Requested: <span className="font-black text-brand-maroon">{item.requested_qty}</span></div>
                    </div>
                    <div className="md:col-span-4">
                      <select value={itemDecisions[item.id]?.status || 'Available'} onChange={e => setItemDecisions({...itemDecisions, [item.id]: {...itemDecisions[item.id], status: e.target.value}})} className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-brand-maroon">
                        <option value="Available">Available (Freeze Stock)</option>
                        <option value="Pending">Pending (Requires ETA)</option>
                        <option value="Not Provided">Not Provided (Reject)</option>
                      </select>
                    </div>
                    {itemDecisions[item.id]?.status === 'Pending' && (
                      <div className="md:col-span-3 animate-in fade-in duration-200">
                        <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">ETA (Days)</label>
                        <input type="number" min="1" required placeholder="ETA Days" value={itemDecisions[item.id]?.eta || ''} onChange={e => setItemDecisions({...itemDecisions, [item.id]: {...itemDecisions[item.id], eta: parseInt(e.target.value)||0}})} className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold outline-none text-center focus:ring-2 focus:ring-amber-500"/>
                      </div>
                    )}
                 </div>
               ))}
               <button type="submit" disabled={!!processingId} className="w-full py-4 mt-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-lg transition disabled:opacity-50">Confirm Process Items</button>
             </form>
           </div>
         </div>
      )}
    </div>
  );
}