import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/useToast';
import { Package, SplitSquareHorizontal, CheckCircle, ShoppingCart, MessageSquare, Trash2, X } from 'lucide-react';
import type { WorkOrder } from '../../types';
import VendorPOEngine from './VendorPOEngine';
import BatchDetailsModal from '../BatchDetailsModal';

export default function MaterialDispatch({ userRole }: { userRole: string }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [batches, setBatches] = useState<WorkOrder[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Modal States
  const [reviewBatch, setReviewBatch] = useState<WorkOrder | null>(null);
  const [itemDecisions, setItemDecisions] = useState<Record<string, { status: string; eta: number }>>({});
  const [poBatch, setPoBatch] = useState<WorkOrder | null>(null);
  const [chatBatch, setChatBatch] = useState<WorkOrder | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WorkOrder | null>(null); // Replaces confirm()

  const fetchMaterials = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('work_orders')
      .select(`*, requester:profiles(full_name, department), items:work_order_items!inner(id, requested_qty, item_type, custom_item_name, status, eta_days, fulfillment_dept, inventory_id, inventory:inventory_items(id, name, physical_stock, freezed_stock))`)
      .in('pipeline_state', ['AUTHORIZED', 'PROCESSING'])
      .order('created_at', { ascending: false });

    if (!error && data) {
      const filtered = data.filter(b => userRole === 'SUPER_ADMIN' || userRole === 'ADMIN' || b.items.some((i: any) => i.fulfillment_dept === userRole));
      setBatches(filtered as WorkOrder[]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchMaterials(); }, [userRole]);

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

  if (loading) return <div className="p-8 text-center animate-pulse text-slate-500">Loading materials...</div>;
  if (batches.length === 0) return <div className="p-12 text-center text-slate-500 font-bold"><Package className="w-12 h-12 mx-auto mb-3 opacity-20"/> No active batches.</div>;

  return (
    <div className="space-y-4">
      {batches.map(b => {
        const isTechPO = b.department === 'Technician Procurement';
        const myItems = b.items.filter(i => userRole === 'SUPER_ADMIN' || i.fulfillment_dept === userRole);
        const needsReview = myItems.some(i => i.status === 'Pending');

        return (
          <div key={b.id} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between gap-4">
            <div className="space-y-3 flex-1 w-full">
              <h3 className="font-black text-brand-maroon">Batch: {b.batch_id}</h3>
              <p className="text-xs text-slate-600 font-semibold">{b.requester?.full_name} • {b.location}</p>
            </div>
            <div className="flex gap-2 flex-wrap md:flex-col md:w-48">
              {isTechPO ? (
                <button onClick={() => setPoBatch(b)} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex justify-center gap-1.5"><ShoppingCart className="w-4 h-4"/> Gen PO</button>
              ) : needsReview ? (
                <button onClick={() => openReviewModal(b)} className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex justify-center gap-1.5"><SplitSquareHorizontal className="w-4 h-4"/> Split/Dispatch</button>
              ) : (
                <div className="w-full py-2.5 bg-slate-100 text-slate-500 font-bold rounded-xl text-xs flex justify-center gap-1.5"><CheckCircle className="w-4 h-4"/> Reviewed</div>
              )}
              <button onClick={() => setChatBatch(b)} className="w-full py-2.5 bg-slate-800 text-white font-bold rounded-xl text-xs flex justify-center gap-1.5"><MessageSquare className="w-4 h-4"/> Thread</button>
              {userRole === 'SUPER_ADMIN' && <button onClick={() => setDeleteTarget(b)} className="w-full py-2.5 bg-red-50 text-red-600 rounded-xl flex justify-center"><Trash2 className="w-4 h-4"/></button>}
            </div>
          </div>
        );
      })}

      {/* Child Modals */}
      {poBatch && user && <VendorPOEngine batch={poBatch} userEmail={user.email || ''} onClose={() => setPoBatch(null)} onSuccess={() => { setPoBatch(null); fetchMaterials(); }} />}
      {chatBatch && user && <BatchDetailsModal batchId={chatBatch.batch_id} workOrderId={chatBatch.id} isOpen={!!chatBatch} onClose={() => setChatBatch(null)} currentUser={user} />}
      
      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-2xl max-w-sm w-full text-center">
            <h3 className="text-lg font-black text-slate-800 mb-2">Eradicate Batch?</h3>
            <p className="text-sm text-slate-500 mb-6">This action is permanent and cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl">Cancel</button>
              <button onClick={confirmDelete} disabled={processingId === deleteTarget.id} className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl">Confirm Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Review Modal (Standard implementation tracking generic Material UI requirements) */}
      {reviewBatch && (
         <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
           {/* Modal Body Extracted safely - standard dropdown state tracking */}
           <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden">
             <div className="bg-brand-maroon p-5 flex justify-between items-center text-white">
               <h3 className="font-extrabold text-sm uppercase">Review Batch</h3>
               <button onClick={() => setReviewBatch(null)}><X className="w-5 h-5"/></button>
             </div>
             <form onSubmit={handleReviewSubmit} className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
               {reviewBatch.items.map(item => (
                 <div key={item.id} className="p-4 border rounded-xl grid grid-cols-12 gap-4 items-center">
                    <div className="col-span-5 font-bold text-sm">{item.custom_item_name || item.inventory?.name}</div>
                    <div className="col-span-4">
                      <select value={itemDecisions[item.id]?.status || 'Available'} onChange={e => setItemDecisions({...itemDecisions, [item.id]: {...itemDecisions[item.id], status: e.target.value}})} className="w-full p-2 border rounded-lg text-sm">
                        <option value="Available">Available (Freeze Stock)</option>
                        <option value="Pending">Pending (Requires ETA)</option>
                        <option value="Not Provided">Reject</option>
                      </select>
                    </div>
                    {itemDecisions[item.id]?.status === 'Pending' && (
                      <div className="col-span-3">
                        <input type="number" min="1" required placeholder="ETA Days" value={itemDecisions[item.id]?.eta || ''} onChange={e => setItemDecisions({...itemDecisions, [item.id]: {...itemDecisions[item.id], eta: parseInt(e.target.value)||0}})} className="w-full p-2 border rounded-lg text-sm"/>
                      </div>
                    )}
                 </div>
               ))}
               <button type="submit" disabled={!!processingId} className="w-full py-4 bg-emerald-600 text-white font-bold rounded-xl uppercase">Process Items</button>
             </form>
           </div>
         </div>
      )}
    </div>
  );
}