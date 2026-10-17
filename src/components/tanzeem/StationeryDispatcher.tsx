import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Package, SplitSquareHorizontal, X, CheckCircle, XCircle, History, ListFilter, RefreshCw, Printer } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import type { WorkOrder } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import AlternativeItemModal from '../siyanat/AlternativeItemModal';
import { generateDispatchSlip } from '../../utils/printDispatchSlip';

interface AltItemInfo {
  id: string;
  name: string;
  category?: string;
  physical_stock: number;
  freezed_stock: number;
  unit: string;
  fulfillment_dept?: string;
}

export default function StationeryDispatcher() {
  const { user } = useAuth();
  const { showToast, toasts, removeToast } = useToast();
  
  const [viewMode, setViewMode] = useState<'active' | 'history'>('active');
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [batches, setBatches] = useState<WorkOrder[]>([]);
  const [reviewBatch, setReviewBatch] = useState<WorkOrder | null>(null);
  const [itemDecisions, setItemDecisions] = useState<Record<string, { status: string; eta: number }>>({});
  const [substitutedItems, setSubstitutedItems] = useState<Record<string, { inventoryItem: AltItemInfo; qty: number; originalName: string }>>({});
  const [approvedQtys, setApprovedQtys] = useState<Record<string, number>>({});
  
  // Alternative modal state
  const [altModalTarget, setAltModalTarget] = useState<{ id: string; name: string; qty: number; dept: string } | null>(null);

  const fetchStationery = useCallback(async () => {
    setLoading(true);
    
    // Include ACTION_REQUIRED in active queue for collection at Tanzeem store counter
    const targetStates = viewMode === 'active' 
      ? ['AUTHORIZED', 'PROCESSING', 'ACTION_REQUIRED'] 
      : ['CLOSED', 'REJECTED'];

    const { data, error } = await supabase
      .from('work_orders')
      .select(`
        *,
        requester:profiles(full_name, department),
        items:work_order_items!inner(
          id, requested_qty, item_type, custom_item_name, status, eta_days, fulfillment_dept, inventory_id,
          inventory:inventory_items(id, name, physical_stock, freezed_stock, unit)
        )
      `)
      .in('pipeline_state', targetStates)
      .eq('items.fulfillment_dept', 'TANZEEM_HEAD')
      .order('created_at', { ascending: false });

    if (error) {
      showToast('Failed to fetch stationery: ' + error.message, 'error');
    } else if (data) {
      setBatches(data as WorkOrder[]);
    }
    setLoading(false);
  }, [viewMode, showToast]);

  useEffect(() => {
    let isMounted = true;
    const run = async () => {
      if (isMounted) await fetchStationery();
    };
    run();
    return () => {
      isMounted = false;
    };
  }, [fetchStationery]);

  const openReviewModal = (batch: WorkOrder) => {
    setReviewBatch(batch);
    setSubstitutedItems({});
    const initialDecisions: Record<string, { status: string; eta: number }> = {};
    const initialQtys: Record<string, number> = {};
    const tanzeemItems = batch.items.filter((i) => i.fulfillment_dept === 'TANZEEM_HEAD');
    
    tanzeemItems.forEach((item) => {
      initialQtys[item.id] = item.requested_qty;
      const physical = item.inventory?.physical_stock || 0;
      const freezed = item.inventory?.freezed_stock || 0;
      const available = Math.max(0, physical - freezed);
      const hasEnoughStock = item.inventory_id && available >= item.requested_qty;

      const defaultStatus = item.status !== 'Pending' && (item.status !== 'Available' || hasEnoughStock)
        ? item.status
        : (hasEnoughStock ? 'Available' : 'Ordered');

      initialDecisions[item.id] = {
        status: defaultStatus,
        eta: item.eta_days || 0
      };
    });
    setItemDecisions(initialDecisions);
    setApprovedQtys(initialQtys);
  };

  const handleApprovedQtyChange = (itemId: string, newQty: number, availableStock: number, isCatalogItem: boolean) => {
    const clamped = Math.max(1, newQty);
    setApprovedQtys(prev => ({ ...prev, [itemId]: clamped }));

    const canDispatchImmediately = isCatalogItem && availableStock > 0 && clamped <= availableStock;
    if (!canDispatchImmediately && itemDecisions[itemId]?.status === 'Available') {
      setItemDecisions(prev => ({
        ...prev,
        [itemId]: { ...prev[itemId], status: 'Ordered', eta: prev[itemId]?.eta || 7 }
      }));
    }
  };

  const handleApplyAlternative = (alternativeItem: AltItemInfo, subQty: number) => {
    if (!altModalTarget || !reviewBatch) return;

    const targetItemId = altModalTarget.id;
    const origName = altModalTarget.name;

    setSubstitutedItems(prev => ({
      ...prev,
      [targetItemId]: {
        inventoryItem: alternativeItem,
        qty: subQty,
        originalName: origName
      }
    }));

    const available = Math.max(0, (alternativeItem.physical_stock || 0) - (alternativeItem.freezed_stock || 0));
    const isEnoughStock = !!alternativeItem.id && available >= subQty;

    setItemDecisions(prev => ({
      ...prev,
      [targetItemId]: {
        status: isEnoughStock ? 'Available' : 'Ordered',
        eta: isEnoughStock ? 0 : 7
      }
    }));

    setApprovedQtys(prev => ({
      ...prev,
      [targetItemId]: subQty
    }));

    setReviewBatch(prev => {
      if (!prev) return null;
      return {
        ...prev,
        items: prev.items.map(i => {
          if (i.id === targetItemId) {
            return {
              ...i,
              inventory_id: alternativeItem.id || null,
              inventory: alternativeItem.id ? (alternativeItem as any) : undefined,
              item_type: alternativeItem.id ? 'Catalog' : 'Custom',
              requested_qty: subQty,
              custom_item_name: `[Alt for: ${origName}] ${alternativeItem.name}`,
              status: isEnoughStock ? 'Available' : 'Ordered'
            };
          }
          return i;
        })
      };
    });

    if (isEnoughStock) {
      showToast(`Substituted with in-stock "${alternativeItem.name}"! Marked Available.`, 'success');
    } else {
      showToast(`Substituted with "${alternativeItem.name}". Marked for PO (Stock: ${available}).`, 'info');
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewBatch || processingId) return;
    setProcessingId(reviewBatch.id);

    try {
      // 1. Update substituted items in DB
      for (const [itemId, sub] of Object.entries(substitutedItems)) {
        const available = Math.max(0, (sub.inventoryItem.physical_stock || 0) - (sub.inventoryItem.freezed_stock || 0));
        const isStocked = !!sub.inventoryItem.id && available >= sub.qty;
        const adjustedQty = approvedQtys[itemId] ?? sub.qty;

        await supabase
          .from('work_order_items')
          .update({
            inventory_id: sub.inventoryItem.id || null,
            item_type: sub.inventoryItem.id ? 'Catalog' : 'Custom',
            custom_item_name: `[Alt for: ${sub.originalName}] ${sub.inventoryItem.name}`,
            requested_qty: adjustedQty,
            status: isStocked ? 'Available' : 'Ordered'
          })
          .eq('id', itemId);

        await supabase.from('work_order_logs').insert({
          work_order_id: reviewBatch.id,
          author_id: user?.id,
          message: `🔄 Alternative Item Provided: "${sub.inventoryItem.name}" (Qty: ${adjustedQty}) substituted in place of "${sub.originalName}".`
        });
      }

      // Persist any quantity adjustments on non-substituted items
      for (const item of reviewBatch.items) {
        if (!substitutedItems[item.id]) {
          const adjQty = approvedQtys[item.id];
          if (adjQty && adjQty !== item.requested_qty) {
            const { error: qtyErr } = await supabase
              .from('work_order_items')
              .update({ requested_qty: adjQty })
              .eq('id', item.id);
            if (qtyErr) throw qtyErr;

            const itemName = item.custom_item_name || item.inventory?.name || 'Item';
            await supabase.from('work_order_logs').insert({
              work_order_id: reviewBatch.id,
              author_id: user?.id,
              message: `📝 Adjusted qty for "${itemName}" from ${item.requested_qty} to ${adjQty}`
            });
          }
        }
      }

      // 2. Prepare payload for process_material_batch_json
      const decisionsPayload = Object.entries(itemDecisions).map(([itemId, dec]) => ({
        item_id: itemId,
        status: dec.status,
        eta: dec.eta
      }));

      const { error: rpcErr } = await supabase.rpc('process_material_batch_json', {
        p_batch_id: reviewBatch.id,
        p_decisions: decisionsPayload,
        p_user_email: user?.email || 'Admin'
      });

      if (rpcErr) throw rpcErr;

      // 3. Operational Split Logic
      const availableIds = Object.entries(itemDecisions)
        .filter(([, dec]) => dec.status === 'Available')
        .map(([id]) => id);

      const orderedIds = Object.entries(itemDecisions)
        .filter(([, dec]) => dec.status === 'Ordered')
        .map(([id]) => id);

      if (availableIds.length > 0 && orderedIds.length > 0) {
        // Partial availability -> Split out-of-stock items to procurement branch
        const poBatchId = `${reviewBatch.batch_id}-PO`;

        const { data: poBatchData, error: poBatchErr } = await supabase
          .from('work_orders')
          .insert({
            batch_id: poBatchId,
            requester_id: reviewBatch.requester?.id || reviewBatch.requester_id || null,
            department: reviewBatch.department,
            location: reviewBatch.location,
            urgency: reviewBatch.urgency,
            reason: `[Stationery Backlog from ${reviewBatch.batch_id}] ${reviewBatch.reason || ''}`,
            pipeline_state: 'PROCESSING',
            dispatch_status: 'Awaiting PO'
          })
          .select()
          .single();

        if (poBatchErr) throw poBatchErr;

        if (poBatchData) {
          await supabase
            .from('work_order_items')
            .update({ work_order_id: poBatchData.id, status: 'Ordered' })
            .in('id', orderedIds);

          await supabase
            .from('work_orders')
            .update({
              pipeline_state: 'ACTION_REQUIRED',
              dispatch_status: 'Ready for Collection'
            })
            .eq('id', reviewBatch.id);

          await supabase.from('work_order_logs').insert([
            {
              work_order_id: reviewBatch.id,
              author_id: user?.id,
              message: `📦 Requisition Split: ${availableIds.length} in-stock stationery item(s) are Ready for Collection under ${reviewBatch.batch_id}. ${orderedIds.length} item(s) moved to procurement branch ${poBatchId}.`
            },
            {
              work_order_id: poBatchData.id,
              author_id: user?.id,
              message: `📋 Procurement backlog split from ${reviewBatch.batch_id}. Awaiting purchase order.`
            }
          ]);

          showToast(`Split complete! In-stock items Ready for Pickup under ${reviewBatch.batch_id}. Remaining items moved to ${poBatchId}.`, "success");
        }
      } else if (availableIds.length > 0 && orderedIds.length === 0) {
        await supabase
          .from('work_orders')
          .update({
            pipeline_state: 'ACTION_REQUIRED',
            dispatch_status: 'Ready for Collection'
          })
          .eq('id', reviewBatch.id);

        showToast("All stationery items available! Batch is Ready for Collection.", "success");
      } else if (availableIds.length === 0 && orderedIds.length > 0) {
        await supabase
          .from('work_orders')
          .update({
            pipeline_state: 'PROCESSING',
            dispatch_status: 'Awaiting PO'
          })
          .eq('id', reviewBatch.id);

        showToast("Stationery items marked for procurement. Sent to RTO queue.", "success");
      } else if (availableIds.length === 0 && orderedIds.length === 0) {
        // ALL items marked as Not Provided (Rejected)
        await supabase
          .from('work_orders')
          .update({
            pipeline_state: 'REJECTED',
            dispatch_status: 'Rejected'
          })
          .eq('id', reviewBatch.id);

        showToast("All items marked as Not Provided. Stationery requisition has been rejected.", "warning");
      }

      setReviewBatch(null);
      fetchStationery();
    } catch (err: unknown) {
      showToast('Error processing batch: ' + (err instanceof Error ? err.message : 'Error'), 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const getActiveBatchBadge = (b: WorkOrder, myItems: { status: string }[]) => {
    if (b.pipeline_state === 'ACTION_REQUIRED') {
      return { label: 'Ready for Collection', className: 'bg-emerald-100 text-emerald-800' };
    }
    const hasPending = myItems.some(i => i.status === 'Pending');
    const hasOrdered = myItems.some(i => i.status === 'Ordered');
    const hasPOIssued = myItems.some(i => i.status === 'PO Issued');
    const allRejectedByMe = myItems.length > 0 && myItems.every(i => i.status === 'Not Provided');

    if (hasPending) {
      return { label: 'Awaiting Dispatch', className: 'bg-amber-100 text-amber-800' };
    }
    if (hasOrdered) {
      return { label: 'Awaiting PO (In RTO Queue)', className: 'bg-purple-100 text-purple-800' };
    }
    if (hasPOIssued) {
      return { label: 'PO Issued (In Transit)', className: 'bg-indigo-100 text-indigo-800' };
    }
    if (allRejectedByMe) {
      return { label: 'Rejected (Needs Sync)', className: 'bg-red-100 text-red-700' };
    }
    return { 
      label: b.dispatch_status || 'Waiting on other Depts', 
      className: 'bg-indigo-100 text-indigo-800' 
    };
  };

  return (
    <div className="space-y-4 relative">
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
            <History className="w-4 h-4" /> History Log
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center font-medium text-slate-500 bg-white rounded-3xl border border-slate-200 shadow-sm animate-pulse">
          Loading stationery batches...
        </div>
      ) : batches.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 shadow-sm">
          <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-bold uppercase tracking-wider text-xs">
            {viewMode === 'active' ? 'No pending stationery requisitions.' : 'No historical records found.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {batches.map((b) => {
            const myItems = b.items?.filter((i) => i.fulfillment_dept === 'TANZEEM_HEAD') || [];
            const needsReview = myItems.some((i) => (i.status as string) === 'Pending');
            const activeBadge = getActiveBatchBadge(b, myItems);
            const isReadyForPickup = b.pipeline_state === 'ACTION_REQUIRED';
            const isSplitPOBatch = b.batch_id?.includes('-PO');

            return (
              <div key={b.id} className={`bg-white rounded-3xl p-5 shadow-sm border flex flex-col lg:flex-row justify-between gap-5 transition hover:shadow-md ${b.pipeline_state === 'REJECTED' ? 'border-red-200' : 'border-slate-200'}`}>
                <div className="space-y-3 flex-1 w-full">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-black text-brand-maroon text-base">Batch: {b.batch_id}</h3>
                    
                    {viewMode === 'active' ? (
                      <span className={`px-2 py-0.5 text-[9px] font-black uppercase rounded ${activeBadge.className}`}>
                        {activeBadge.label}
                      </span>
                    ) : (
                      <span className={`px-2 py-0.5 text-[9px] font-black uppercase rounded ${b.pipeline_state === 'REJECTED' ? 'bg-red-100 text-red-600' : b.pipeline_state === 'CLOSED' ? 'bg-slate-200 text-slate-600' : 'bg-emerald-100 text-emerald-800'}`}>
                        {b.pipeline_state === 'REJECTED' ? 'Rejected' : b.pipeline_state === 'CLOSED' ? 'Picked Up' : 'Awaiting Pickup'}
                      </span>
                    )}

                    {isSplitPOBatch && (
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200">
                        Procurement Backlog
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 font-bold uppercase">{b.requester?.full_name} • {b.location}</p>
                  
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Stationery Items in Batch:</span>
                    {myItems.map((item) => {
                      const statusStr = item.status as string;
                      const isSubstituted = item.custom_item_name?.includes('[Alt for:');

                      return (
                        <div key={item.id} className="text-xs font-bold text-slate-700 flex justify-between items-center py-1">
                          <div>
                            <span>{item.inventory?.name || item.custom_item_name}</span>
                            {isSubstituted && (
                              <span className="ml-1.5 text-[9px] font-black text-indigo-700 bg-indigo-100 px-1 py-0.5 rounded">
                                Substituted
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                              statusStr === 'Available' || statusStr === 'Stock Injected'
                                ? 'bg-emerald-100 text-emerald-700'
                                : statusStr === 'Not Provided'
                                ? 'bg-red-100 text-red-600'
                                : statusStr === 'Ordered' || statusStr === 'PO Issued'
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-amber-100 text-amber-800'
                            }`}>
                              {statusStr}
                            </span>
                            <span className="text-brand-maroon font-black">Qty: {item.requested_qty}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                {viewMode === 'active' && (
                  <div className="flex flex-col justify-center gap-2 lg:w-48">
                    {isReadyForPickup && (
                      <div className="w-full p-2 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                        <span className="text-[10px] font-black text-emerald-800 uppercase tracking-wide block">Ready at Counter</span>
                        <span className="text-[9px] text-emerald-600 font-bold">Ready for Pickup</span>
                      </div>
                    )}

                    {needsReview ? (
                      <button onClick={() => openReviewModal(b)} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-wider rounded-xl text-xs shadow-sm flex items-center justify-center gap-1.5 transition">
                        <SplitSquareHorizontal className="w-4 h-4"/> Review & Split
                      </button>
                    ) : (
                      <button onClick={() => openReviewModal(b)} className="w-full py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-black uppercase tracking-wider rounded-xl text-xs shadow-sm flex items-center justify-center gap-1.5 transition">
                        <SplitSquareHorizontal className="w-4 h-4" /> Edit Decisions
                      </button>
                    )}

                    <button 
                      onClick={() => generateDispatchSlip(b, 'TANZEEM_HEAD', { onlyAvailable: true })} 
                      className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black uppercase tracking-wider rounded-xl text-xs flex items-center justify-center gap-1.5 border border-slate-300 shadow-sm transition"
                    >
                      <Printer className="w-4 h-4 text-slate-600"/> Print Gate Slip
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Review Modal */}
      {reviewBatch && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex justify-center items-end sm:items-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in duration-300">
            <div className="bg-brand-maroon p-5 flex justify-between items-center text-white">
              <div>
                <h3 className="font-extrabold text-sm uppercase">Stationery Dispatch: {reviewBatch.batch_id}</h3>
                <p className="text-[11px] text-amber-200 font-medium">In-stock items will dispatch immediately</p>
              </div>
              <button onClick={() => setReviewBatch(null)} className="p-1 hover:bg-white/20 rounded-lg transition">
                <X className="w-5 h-5 hover:text-red-300" />
              </button>
            </div>

            <form onSubmit={handleReviewSubmit} className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {reviewBatch.items.filter((i) => i.fulfillment_dept === 'TANZEEM_HEAD').map((item) => {
                const itemName = item.custom_item_name || (item.item_type === 'Catalog' && item.inventory ? item.inventory.name : 'Item');
                const physicalStock = item.inventory?.physical_stock || 0;
                const frozenStock = item.inventory?.freezed_stock || 0;
                const availableStock = Math.max(0, physicalStock - frozenStock);
                const isCatalogItem = !!item.inventory_id;
                const currentApprovedQty = approvedQtys[item.id] ?? item.requested_qty;
                const hasEnoughStock = isCatalogItem && availableStock > 0 && currentApprovedQty <= availableStock;
                const isSubstituted = !!substitutedItems[item.id] || item.custom_item_name?.includes('[Alt for:');

                return (
                  <div key={item.id} className="p-4 border border-slate-200 rounded-2xl bg-white shadow-sm grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                    <div className="md:col-span-5 space-y-1.5">
                      <div className="font-bold text-slate-800 text-sm">{itemName}</div>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                        <span>Original Req: <strong className="font-black text-brand-maroon">{item.requested_qty}</strong></span>
                        <span className="text-slate-300">•</span>
                        {isCatalogItem ? (
                          <span className={`font-black px-1.5 py-0.5 rounded text-[10px] ${availableStock > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'}`}>
                            Stock Avail: {availableStock}
                          </span>
                        ) : (
                          <span className="bg-amber-100 text-amber-800 font-black px-1.5 py-0.5 rounded text-[10px]">
                            Custom
                          </span>
                        )}
                        {isSubstituted && (
                          <span className="bg-indigo-100 text-indigo-800 font-black px-1.5 py-0.5 rounded text-[10px]">
                            Substituted
                          </span>
                        )}
                      </div>

                      {/* Editable Approve / Dispatch Qty input */}
                      <div className="flex items-center gap-2 pt-1">
                        <label className="text-[10px] font-black uppercase text-slate-600">Approve / Dispatch Qty:</label>
                        <input
                          type="number"
                          min={1}
                          value={currentApprovedQty}
                          onChange={(e) => handleApprovedQtyChange(item.id, parseInt(e.target.value) || 1, availableStock, isCatalogItem)}
                          className="w-16 p-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-black text-center outline-none focus:ring-2 focus:ring-brand-maroon"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => setAltModalTarget({
                          id: item.id,
                          name: item.custom_item_name || item.inventory?.name || 'Item',
                          qty: currentApprovedQty,
                          dept: 'TANZEEM_HEAD'
                        })}
                        className="mt-1 text-[10px] font-black uppercase text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2 py-0.5 rounded-lg flex items-center gap-1 transition"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Swap / Substitute Item</span>
                      </button>
                    </div>

                    <div className="md:col-span-4">
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Decision</label>
                      <select
                        value={itemDecisions[item.id]?.status || (hasEnoughStock ? 'Available' : 'Ordered')}
                        onChange={(e) =>
                          setItemDecisions({
                            ...itemDecisions,
                            [item.id]: { ...itemDecisions[item.id], status: e.target.value }
                          })
                        }
                        className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-brand-maroon"
                      >
                        {hasEnoughStock ? (
                          <>
                            <option value="Available">In Stock (Dispatch Immediately)</option>
                            <option value="Ordered">Not in Stock (Requires PO)</option>
                            <option value="Not Provided">Not Provided (Reject)</option>
                          </>
                        ) : (
                          <>
                            <option value="Ordered">Not in Stock (Requires PO)</option>
                            <option value="Not Provided">Not Provided (Reject)</option>
                          </>
                        )}
                      </select>
                    </div>

                    <div className="md:col-span-3">
                      {itemDecisions[item.id]?.status === 'Ordered' ? (
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
                      ) : itemDecisions[item.id]?.status === 'Not Provided' ? (
                        <div className="text-center text-[10px] font-black text-rose-700 bg-rose-50 border border-rose-200 p-2 rounded-xl">
                          ✕ Rejected
                        </div>
                      ) : (
                        <div className="text-center text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 p-2 rounded-xl">
                          ✓ Ready for Pickup
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Split Notice Banner */}
              {Object.values(itemDecisions).some(d => d.status === 'Available') && 
               Object.values(itemDecisions).some(d => d.status === 'Ordered') && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-2 text-xs font-bold text-amber-800">
                  <SplitSquareHorizontal className="w-5 h-5 text-amber-600 shrink-0" />
                  <div>
                    <span>Mixed Allocation Detected: In-stock stationery will be dispatched under <strong>{reviewBatch.batch_id}</strong> immediately. Out-of-stock items will automatically split into <strong>{reviewBatch.batch_id}-PO</strong>.</span>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={!!processingId}
                className="w-full py-4 mt-6 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase tracking-wide rounded-xl shadow-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {processingId === reviewBatch.id ? 'Processing Allocation...' : 'Confirm Stationery Dispatch & Split'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Alternative Item Picker Modal */}
      {altModalTarget && (
        <AlternativeItemModal
          isOpen={!!altModalTarget}
          onClose={() => setAltModalTarget(null)}
          requestedItemName={altModalTarget.name}
          requestedQty={altModalTarget.qty}
          fulfillmentDept={altModalTarget.dept}
          onConfirmAlternative={handleApplyAlternative}
        />
      )}

      {/* Toast Notification Renderer */}
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