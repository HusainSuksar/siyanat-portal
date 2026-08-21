import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Package, SplitSquareHorizontal, X, CheckCircle, XCircle } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import type { WorkOrder } from '../../types';
import { useAuth } from '../../contexts/AuthContext';

export default function StationeryDispatcher() {
  const { user } = useAuth();
  const { showToast, toasts, removeToast } = useToast(); // THE FIX: Pulled in toasts array
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [batches, setBatches] = useState<WorkOrder[]>([]);
  const [reviewBatch, setReviewBatch] = useState<WorkOrder | null>(null);
  const [itemDecisions, setItemDecisions] = useState<Record<string, { status: string; eta: number }>>({});

  const fetchStationery = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('work_orders')
      .select(`
        *,
        requester:profiles(full_name, department),
        items:work_order_items!inner(
          id, requested_qty, item_type, custom_item_name, status, eta_days, fulfillment_dept, inventory_id,
          inventory:inventory_items(id, name, physical_stock, freezed_stock)
        )
      `)
      .in('pipeline_state', ['AUTHORIZED', 'PROCESSING'])
      .eq('items.fulfillment_dept', 'TANZEEM_HEAD')
      .order('created_at', { ascending: false });

    if (error) {
      showToast('Failed to fetch stationery: ' + error.message, 'error');
    } else if (data) {
      setBatches(data as WorkOrder[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchStationery();
  }, []);

  const openReviewModal = (batch: WorkOrder) => {
    setReviewBatch(batch);
    const initialDecisions: Record<string, { status: string; eta: number }> = {};
    const tanzeemItems = batch.items.filter((i) => i.fulfillment_dept === 'TANZEEM_HEAD');
    
    tanzeemItems.forEach((item) => {
      initialDecisions[item.id] = {
        status: item.status === 'Pending' ? 'Available' : item.status,
        eta: item.eta_days || 0
      };
    });
    setItemDecisions(initialDecisions);
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewBatch) return;
    setProcessingId(reviewBatch.id);

    try {
      const decisionsPayload = Object.entries(itemDecisions).map(([itemId, dec]) => ({
        item_id: itemId,
        status: dec.status,
        eta: dec.eta
      }));

      // Calls the unified DB function we just created
      const { error } = await supabase.rpc('process_material_batch_json', {
        p_batch_id: reviewBatch.id,
        p_decisions: decisionsPayload,
        p_user_email: user?.email || 'Admin'
      });

      if (error) throw error;

      showToast('Stationery batch processed and stock updated!', 'success');
      setReviewBatch(null);
      fetchStationery();
    } catch (err: any) {
      showToast('Error processing batch: ' + err.message, 'error');
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center font-medium text-slate-500 bg-white rounded-3xl border border-slate-200 shadow-sm animate-pulse">
        Loading stationery batches...
      </div>
    );
  }

  if (batches.length === 0) {
    return (
      <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 shadow-sm">
        <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-500 font-bold uppercase tracking-wider text-xs">No pending stationery requisitions.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 relative">
      <div className="grid grid-cols-1 gap-4">
        {batches.map((b) => {
          const myItems = b.items?.filter((i) => i.fulfillment_dept === 'TANZEEM_HEAD') || [];
          const needsReview = myItems.some((i) => i.status === 'Pending');

          return (
            <div key={b.id} className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200 flex flex-col lg:flex-row justify-between gap-5 transition hover:shadow-md">
              <div className="space-y-3 flex-1 w-full">
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-brand-maroon text-base">Batch: {b.batch_id}</h3>
                  <span className={`px-2 py-0.5 text-[9px] font-black uppercase rounded ${b.pipeline_state === 'PROCESSING' ? 'bg-indigo-100 text-indigo-800' : 'bg-amber-100 text-amber-800'}`}>
                    {b.pipeline_state === 'PROCESSING' ? 'Waiting on other Depts' : 'Awaiting Dispatch'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-bold uppercase">{b.requester?.full_name} • {b.location}</p>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Stationery Items in Batch:</span>
                  {myItems.map((item) => (
                    <div key={item.id} className="text-xs font-bold text-slate-700 flex justify-between py-0.5">
                      <span>{item.inventory?.name || item.custom_item_name}</span>
                      <span className="text-brand-maroon">Qty: {item.requested_qty}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex flex-col justify-center lg:w-48">
                {needsReview ? (
                  <button onClick={() => openReviewModal(b)} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-wider rounded-xl text-xs shadow-sm flex items-center justify-center gap-1.5 transition">
                    <SplitSquareHorizontal className="w-4 h-4"/> Split & Dispatch
                  </button>
                ) : (
                  <div className="w-full py-3 bg-slate-100 text-slate-500 font-black uppercase tracking-wider rounded-xl text-xs flex items-center justify-center gap-1.5 border border-slate-200">
                    <CheckCircle className="w-4 h-4" /> Reviewed
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Review Modal */}
      {reviewBatch && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex justify-center items-end sm:items-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in duration-300">
            <div className="bg-brand-maroon p-5 flex justify-between items-center text-white">
              <h3 className="font-extrabold text-sm uppercase">Stationery Dispatch: {reviewBatch.batch_id}</h3>
              <button onClick={() => setReviewBatch(null)} className="p-1 hover:bg-white/20 rounded-lg transition">
                <X className="w-5 h-5 hover:text-red-300" />
              </button>
            </div>
            <form onSubmit={handleReviewSubmit} className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {reviewBatch.items.filter((i) => i.fulfillment_dept === 'TANZEEM_HEAD').map((item) => {
                const itemName = item.item_type === 'Catalog' && item.inventory ? item.inventory.name : item.custom_item_name;
                const physicalStock = item.inventory?.physical_stock || 0;
                const frozenStock = item.inventory?.freezed_stock || 0;
                const availableStock = Math.max(0, physicalStock - frozenStock);

                return (
                  <div key={item.id} className="p-4 border border-slate-200 rounded-2xl bg-white shadow-sm grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                    <div className="md:col-span-5">
                      <div className="font-bold text-slate-800 text-sm">{itemName}</div>
                      <div className="text-[11px] text-slate-500">
                        Requested: <span className="font-bold text-brand-maroon">{item.requested_qty}</span>
                        {item.item_type === 'Catalog' && ` | Avail: ${availableStock}`}
                      </div>
                    </div>
                    <div className="md:col-span-4">
                      <select
                        value={itemDecisions[item.id]?.status || 'Available'}
                        onChange={(e) =>
                          setItemDecisions({
                            ...itemDecisions,
                            [item.id]: { ...itemDecisions[item.id], status: e.target.value }
                          })
                        }
                        className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-brand-maroon"
                      >
                        <option value="Available">Available (Freeze Stock)</option>
                        <option value="Ordered">Pending (Requires ETA)</option>
                        <option value="Not Provided">Not Provided (Reject)</option>
                      </select>
                    </div>
                    <div className="md:col-span-3">
                      {itemDecisions[item.id]?.status === 'Ordered' && (
                        <div className="animate-in fade-in duration-200">
                          <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">ETA (Days)</label>
                          <input
                            type="number"
                            min="1"
                            required
                            value={itemDecisions[item.id]?.eta || ''}
                            onChange={(e) =>
                              setItemDecisions({
                                ...itemDecisions,
                                [item.id]: { ...itemDecisions[item.id], eta: parseInt(e.target.value) || 0 }
                              })
                            }
                            className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-bold outline-none text-center focus:ring-2 focus:ring-amber-500"
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
                className="w-full py-4 mt-6 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase tracking-wide rounded-xl shadow-lg transition disabled:opacity-50"
              >
                Confirm Stationery Dispatch
              </button>
            </form>
          </div>
        </div>
      )}

      {/* THE FIX: Toast Notification Renderer */}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div 
            key={t.id} 
            onClick={() => removeToast(t.id)} 
            className={`p-4 rounded-2xl shadow-2xl text-white text-sm font-bold flex items-center gap-3 pointer-events-auto cursor-pointer animate-in slide-in-from-bottom-5 duration-300 ${t.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'}`}
          >
            {t.type === 'error' ? <XCircle className="w-5 h-5"/> : <CheckCircle className="w-5 h-5"/>}
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}