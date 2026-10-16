import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/useToast';
import { 
  SplitSquareHorizontal, CheckCircle, ShoppingCart, 
  MessageSquare, Trash2, X, ListFilter, History as HistoryIcon, Printer, Calendar,
  RefreshCw, Check, ArrowRight
} from 'lucide-react';
import type { WorkOrder } from '../../types';
import VendorPOEngine from './VendorPOEngine';
import BatchDetailsModal from '../BatchDetailsModal';
import AlternativeItemModal from './AlternativeItemModal';
import { generateDispatchSlip } from '../../utils/printDispatchSlip';

interface EventRequirement {
  id: string;
  item_name?: string;
  approved_qty?: number;
  status?: string;
  department?: string;
}

interface EventSetupItem {
  id: string;
  event_title: string;
  location: string;
  event_date: string;
  time_slot: string;
  siyanat_status?: string;
  avit_status?: string;
  requirements?: EventRequirement[];
}

interface AltItemInfo {
  id: string;
  name: string;
  category?: string;
  physical_stock: number;
  freezed_stock: number;
  unit: string;
  fulfillment_dept?: string;
}

// Helper to categorize AVIT items reliably
const isAvitItem = (item: EventRequirement | string) => {
  const name = typeof item === 'string' ? item : (item?.item_name || '');
  const dept = typeof item === 'object' ? (item?.department || '') : '';
  if (dept === 'AVIT' || dept === 'AVIT_HEAD') return true;
  if (dept === 'SIYANAT' || dept === 'SIYANAT_HEAD') return false;
  return /(projector|mic|microphone|audio|recording|screen|sound|pa system|speaker|camera|hdmi|display|avit|laptop|computer|pc|pointer|marker gadget|gadget|clicker|presenter|laser|tv|monitor|cable)/i.test(name);
};

export default function MaterialDispatch({ userRole }: { userRole: string }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  
  const [viewMode, setViewMode] = useState<'active' | 'history' | 'event_setups'>('active');
  const [loading, setLoading] = useState(true);
  const [batches, setBatches] = useState<WorkOrder[]>([]);
  const [eventSetups, setEventSetups] = useState<EventSetupItem[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const [reviewBatch, setReviewBatch] = useState<WorkOrder | null>(null);
  const [itemDecisions, setItemDecisions] = useState<Record<string, { status: string; eta: number }>>({});
  const [substitutedItems, setSubstitutedItems] = useState<Record<string, { inventoryItem: AltItemInfo; qty: number; originalName: string }>>({});
  
  // Alternative Item Modal State
  const [altModalTarget, setAltModalTarget] = useState<{ id: string; name: string; qty: number; dept: string } | null>(null);

  const [poBatch, setPoBatch] = useState<WorkOrder | null>(null);
  const [chatBatch, setChatBatch] = useState<WorkOrder | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WorkOrder | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);

    if (viewMode === 'event_setups') {
      const { data } = await supabase
        .from('events')
        .select(`*, requirements:event_requirements(*)`)
        .in('pipeline_state', ['PROCESSING', 'AUTHORIZED'])
        .order('event_date', { ascending: true });
        
      if (data) {
        const filtered = data.filter(e => {
          if (userRole === 'SUPER_ADMIN' || userRole === 'ADMIN') return e.siyanat_status !== 'Not Required' || e.avit_status !== 'Not Required';
          if (userRole === 'SIYANAT_HEAD') return e.siyanat_status !== 'Not Required';
          if (userRole === 'AVIT_HEAD') return e.avit_status !== 'Not Required';
          return false;
        });
        setEventSetups(filtered);
      }
    } else {
      // Keep ACTION_REQUIRED in active queue so storekeepers can physically hand over items at counter!
      const targetStates = viewMode === 'active' 
        ? ['AUTHORIZED', 'PROCESSING', 'ACTION_REQUIRED'] 
        : ['CLOSED', 'REJECTED'];

      const { data, error } = await supabase
        .from('work_orders')
        .select(`*, requester:profiles(full_name, department), items:work_order_items!inner(id, requested_qty, item_type, custom_item_name, status, eta_days, fulfillment_dept, inventory_id, inventory:inventory_items(id, name, physical_stock, freezed_stock, unit))`)
        .in('pipeline_state', targetStates)
        .order('created_at', { ascending: false });

      if (!error && data) {
        const filtered = data.filter(b => userRole === 'SUPER_ADMIN' || userRole === 'ADMIN' || b.items.some((i: { fulfillment_dept: string }) => i.fulfillment_dept === userRole));
        setBatches(filtered as WorkOrder[]);
      }
    }
    setLoading(false);
  }, [userRole, viewMode]);

  useEffect(() => {
    let isMounted = true;
    const run = async () => {
      if (isMounted) await fetchData();
    };
    run();
    return () => {
      isMounted = false;
    };
  }, [fetchData]);

  const handleAcknowledgeEvent = async (eventId: string, targetDept: string) => {
    setProcessingId(eventId);
    try {
      const { error } = await supabase.rpc('acknowledge_event_handoff', {
        p_event_id: eventId,
        p_dept: targetDept,
        p_user_email: user?.email
      });
      if (error) throw error;
      showToast('Event Setup Acknowledged!', 'success');
      fetchData();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to acknowledge event', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const openReviewModal = (batch: WorkOrder) => {
    setReviewBatch(batch);
    setSubstitutedItems({});
    const initial: Record<string, { status: string; eta: number }> = {};
    
    batch.items
      .filter(i => userRole === 'SUPER_ADMIN' || userRole === 'ADMIN' || i.fulfillment_dept === userRole)
      .forEach(item => {
        const physical = item.inventory?.physical_stock || 0;
        const freezed = item.inventory?.freezed_stock || 0;
        const available = Math.max(0, physical - freezed);
        const hasEnoughStock = item.inventory_id && available >= item.requested_qty;

        const defaultStatus = item.status !== 'Pending' 
          ? item.status 
          : (hasEnoughStock ? 'Available' : 'Ordered');

        initial[item.id] = { 
          status: defaultStatus, 
          eta: item.eta_days || 0 
        };
      });

    setItemDecisions(initial);
  };

  const handleApplyAlternative = (alternativeItem: AltItemInfo, subQty: number) => {
    if (!altModalTarget || !reviewBatch) return;

    const targetItemId = altModalTarget.id;
    const origName = altModalTarget.name;

    // Record substitution
    setSubstitutedItems(prev => ({
      ...prev,
      [targetItemId]: {
        inventoryItem: alternativeItem,
        qty: subQty,
        originalName: origName
      }
    }));

    // Mark as Available in decisions
    setItemDecisions(prev => ({
      ...prev,
      [targetItemId]: {
        status: 'Available',
        eta: 0
      }
    }));

    // Update the in-memory reviewBatch so modal immediately reflects catalog item with stock!
    setReviewBatch(prev => {
      if (!prev) return null;
      return {
        ...prev,
        items: prev.items.map(i => {
          if (i.id === targetItemId) {
            return {
              ...i,
              inventory_id: alternativeItem.id,
              inventory: alternativeItem,
              item_type: 'Catalog',
              requested_qty: subQty,
              custom_item_name: `${alternativeItem.name} [Alt for: ${origName}]`,
              status: 'Available'
            };
          }
          return i;
        })
      };
    });

    showToast(`Substituted with in-stock "${alternativeItem.name}"! Marked Available.`, 'success');
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewBatch) return;
    setProcessingId(reviewBatch.id);

    try {
      // 1. Persist any item substitutions into work_order_items table
      for (const [itemId, sub] of Object.entries(substitutedItems)) {
        const { error: subErr } = await supabase
          .from('work_order_items')
          .update({
            inventory_id: sub.inventoryItem.id,
            item_type: 'Catalog',
            custom_item_name: `${sub.inventoryItem.name} [Alt for: ${sub.originalName}]`,
            requested_qty: sub.qty,
            status: 'Available'
          })
          .eq('id', itemId);

        if (subErr) throw subErr;

        // Post notice in batch thread
        await supabase.from('work_order_logs').insert({
          work_order_id: reviewBatch.id,
          author_id: user?.id,
          message: `🔄 Alternative Item Provided: In-stock "${sub.inventoryItem.name}" (Qty: ${sub.qty}) substituted in place of "${sub.originalName}".`
        });
      }

      // 2. Prepare payload for process_material_batch_json
      const payload = Object.entries(itemDecisions).map(([id, dec]) => ({ 
        item_id: id, 
        status: dec.status, 
        eta: dec.eta 
      }));

      // Call database procedure to freeze/reserve stock
      const { error: rpcErr } = await supabase.rpc('process_material_batch_json', {
        p_batch_id: reviewBatch.id,
        p_decisions: payload,
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
        // --- MIXED BATCH: Split out-of-stock items to child procurement branch! ---
        const poBatchId = `${reviewBatch.batch_id}-PO`;

        const { data: poBatchData, error: poBatchErr } = await supabase
          .from('work_orders')
          .insert({
            batch_id: poBatchId,
            requester_id: reviewBatch.requester?.id || reviewBatch.requester_id || null,
            department: reviewBatch.department,
            location: reviewBatch.location,
            urgency: reviewBatch.urgency,
            reason: `[Procurement Backlog from ${reviewBatch.batch_id}] ${reviewBatch.reason || ''}`,
            pipeline_state: 'PROCESSING',
            dispatch_status: 'Awaiting PO'
          })
          .select()
          .single();

        if (poBatchErr) throw poBatchErr;

        if (poBatchData) {
          // Re-parent ordered items to the new PO batch
          const { error: moveErr } = await supabase
            .from('work_order_items')
            .update({ work_order_id: poBatchData.id, status: 'Ordered' })
            .in('id', orderedIds);

          if (moveErr) throw moveErr;

          // Advance original batch (which now contains only Available items) to ACTION_REQUIRED!
          const { error: parentStateErr } = await supabase
            .from('work_orders')
            .update({
              pipeline_state: 'ACTION_REQUIRED',
              dispatch_status: 'Ready for Collection'
            })
            .eq('id', reviewBatch.id);

          if (parentStateErr) throw parentStateErr;

          // Post audit logs to both work order chat threads
          await supabase.from('work_order_logs').insert([
            {
              work_order_id: reviewBatch.id,
              author_id: user?.id,
              message: `📦 Requisition Split: ${availableIds.length} in-stock item(s) are Ready for Collection under ${reviewBatch.batch_id}. ${orderedIds.length} item(s) moved to procurement branch ${poBatchId}.`
            },
            {
              work_order_id: poBatchData.id,
              author_id: user?.id,
              message: `📋 Procurement backlog split from ${reviewBatch.batch_id}. Awaiting vendor Purchase Order issuance.`
            }
          ]);

          showToast(`Split complete! In-stock items Ready for Pickup under ${reviewBatch.batch_id}. Remaining items moved to ${poBatchId} for PO.`, "success");
        }
      } else if (availableIds.length > 0 && orderedIds.length === 0) {
        // ALL items available!
        await supabase
          .from('work_orders')
          .update({
            pipeline_state: 'ACTION_REQUIRED',
            dispatch_status: 'Ready for Collection'
          })
          .eq('id', reviewBatch.id);

        showToast("All items verified in stock! Requisition is Ready for Collection.", "success");
      } else if (availableIds.length === 0 && orderedIds.length > 0) {
        // ALL items ordered
        await supabase
          .from('work_orders')
          .update({
            pipeline_state: 'PROCESSING',
            dispatch_status: 'Awaiting PO'
          })
          .eq('id', reviewBatch.id);

        showToast("All items marked for procurement. Batch sent to RTO queue.", "success");
      }

      setReviewBatch(null);
      fetchData();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Error processing batch', "error");
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
    fetchData();
    setProcessingId(null);
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
      return { label: 'Awaiting PO (In RTO)', className: 'bg-purple-100 text-purple-800' };
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
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-2 rounded-2xl border border-slate-200 shadow-sm w-full mb-4">
        <div className="flex flex-wrap gap-2 w-full">
          <button onClick={() => setViewMode('active')} className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition ${viewMode === 'active' ? 'bg-brand-maroon text-brand-gold shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}>
            <ListFilter className="w-4 h-4" /> Active Queue
          </button>
          <button onClick={() => setViewMode('event_setups')} className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition ${viewMode === 'event_setups' ? 'bg-purple-700 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}>
            <Calendar className="w-4 h-4" /> Event Setups
          </button>
          <button onClick={() => setViewMode('history')} className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition ${viewMode === 'history' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}>
            <HistoryIcon className="w-4 h-4" /> History Log
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center animate-pulse text-slate-500 font-bold bg-white rounded-3xl border border-slate-200">Loading records...</div>
      ) : viewMode === 'event_setups' ? (
        // --- EVENT SETUPS VIEW ---
        eventSetups.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 shadow-sm">
            <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-bold uppercase tracking-wider text-xs">No pending event setups.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {eventSetups.map(e => {
              const siyItems = e.requirements?.filter((r: EventRequirement) => r.status === 'Approved' && !isAvitItem(r)) || [];
              const avitItems = e.requirements?.filter((r: EventRequirement) => r.status === 'Approved' && isAvitItem(r)) || [];

              const showSiy = (userRole === 'SIYANAT_HEAD' || userRole === 'SUPER_ADMIN' || userRole === 'ADMIN') && e.siyanat_status !== 'Not Required';
              const showAvit = (userRole === 'AVIT_HEAD' || userRole === 'SUPER_ADMIN' || userRole === 'ADMIN') && e.avit_status !== 'Not Required';

              return (
                <div key={e.id} className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200 flex flex-col md:flex-row gap-5">
                  <div className="flex-1 space-y-3">
                    <h3 className="font-black text-purple-800 text-lg leading-tight">{e.event_title}</h3>
                    <p className="text-xs text-slate-600 font-bold uppercase tracking-wider">{e.location} • {new Date(e.event_date).toLocaleDateString()} ({e.time_slot})</p>
                    
                    <div className="flex flex-col gap-2 mt-2">
                      {showSiy && (
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Siyanat Facility Setup</span>
                          {siyItems.length === 0 ? <span className="text-xs text-slate-400 italic">General Room Setup</span> : siyItems.map((req: EventRequirement) => (
                            <div key={req.id} className="text-xs font-bold text-slate-700 py-0.5">• {req.item_name} (x{req.approved_qty || 1})</div>
                          ))}
                        </div>
                      )}
                      {showAvit && (
                        <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-100">
                          <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1 block">AVIT Presentation Setup</span>
                          {avitItems.length === 0 ? <span className="text-xs text-indigo-400 italic">General AVIT Setup</span> : avitItems.map((req: EventRequirement) => (
                            <div key={req.id} className="text-xs font-bold text-indigo-800 py-0.5">• {req.item_name} (x{req.approved_qty || 1})</div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex md:flex-col justify-end gap-2 shrink-0 md:w-48">
                    {showSiy && e.siyanat_status === 'Pending' && (
                      <button 
                        onClick={() => handleAcknowledgeEvent(e.id, 'SIYANAT')} 
                        disabled={processingId === e.id}
                        className="flex-1 py-3 px-4 bg-purple-700 hover:bg-purple-800 text-white font-black text-[11px] uppercase tracking-wider rounded-xl shadow-md transition disabled:opacity-50"
                      >
                        Acknowledge Siyanat
                      </button>
                    )}
                    {showAvit && e.avit_status === 'Pending' && (
                      <button 
                        onClick={() => handleAcknowledgeEvent(e.id, 'AVIT')} 
                        disabled={processingId === e.id}
                        className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[11px] uppercase tracking-wider rounded-xl shadow-md transition disabled:opacity-50"
                      >
                        Acknowledge AVIT
                      </button>
                    )}
                    {((showSiy && e.siyanat_status === 'Acknowledged') || (showAvit && e.avit_status === 'Acknowledged')) && (
                      <div className="flex items-center gap-1.5 text-emerald-600 text-xs font-black uppercase tracking-wider py-2">
                        <Check className="w-4 h-4 stroke-[3]" /> Acknowledged
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        // --- ACTIVE QUEUE / HISTORY VIEW ---
        batches.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 text-slate-400 font-bold uppercase tracking-wider text-xs">
            No {viewMode} material batches found.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {batches.map(b => {
              const myItems = b.items?.filter(i => userRole === 'SUPER_ADMIN' || userRole === 'ADMIN' || i.fulfillment_dept === userRole) || [];
              const badge = getActiveBatchBadge(b, myItems);
              const needsReview = myItems.some(i => (i.status as string) === 'Pending');
              const needsPO = myItems.some(i => (i.status as string) === 'Ordered');
              const isReadyForPickup = b.pipeline_state === 'ACTION_REQUIRED';
              const isSplitPOBatch = b.batch_id?.includes('-PO');

              return (
                <div key={b.id} className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between gap-4 transition hover:shadow-md">
                  <div className="flex-1 space-y-3">
                    {/* Header info */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-black text-brand-maroon text-base tracking-tight">{b.batch_id}</span>
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${badge.className}`}>
                        {badge.label}
                      </span>
                      {isSplitPOBatch && (
                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200">
                          Procurement Backlog
                        </span>
                      )}
                      <span className="text-[10px] font-bold text-slate-400">
                        {b.created_at ? new Date(b.created_at).toLocaleDateString() : ''}
                      </span>
                    </div>

                    <div className="text-xs text-slate-600 font-semibold space-y-0.5">
                      <p><strong className="text-slate-800">Requester:</strong> {b.requester?.full_name || 'Staff'} ({b.requester?.department || b.department || 'Campus'})</p>
                      <p><strong className="text-slate-800">Location:</strong> {b.location}</p>
                      {b.reason && <p className="italic text-slate-500 font-normal">"{b.reason}"</p>}
                    </div>

                    {/* Items preview list */}
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 space-y-1.5">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                        Materials in Batch ({myItems.length} items):
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {myItems.map(item => {
                          const isItemReady = item.status === 'Available' || item.status === 'Stock Injected';
                          const isItemOrdered = item.status === 'Ordered';
                          const isSubstituted = item.custom_item_name?.includes('[Alt for:');

                          return (
                            <div 
                              key={item.id} 
                              className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                                isItemReady
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                  : isItemOrdered
                                  ? 'bg-purple-50 border-purple-200 text-purple-800'
                                  : 'bg-white border-slate-200 text-slate-700'
                              }`}
                            >
                              <div>
                                <span>{item.custom_item_name || item.inventory?.name || 'Item'}</span>
                                {isSubstituted && (
                                  <span className="ml-1.5 text-[9px] font-black text-indigo-700 bg-indigo-100 px-1 py-0.5 rounded">
                                    Substituted
                                  </span>
                                )}
                              </div>
                              <span className="text-brand-maroon font-black">x{item.requested_qty}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Actions column */}
                  <div className="flex gap-2 flex-wrap md:flex-col md:w-48 justify-center border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-5">
                    {viewMode === 'active' && (
                      <>
                        {isReadyForPickup ? (
                          <div className="w-full p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-center mb-1">
                            <span className="text-[10px] font-black text-emerald-800 uppercase tracking-wide block">Ready at Counter</span>
                            <span className="text-[9px] text-emerald-600 font-bold">Awaiting requester collection</span>
                          </div>
                        ) : null}

                        {needsReview && (
                          <button onClick={() => openReviewModal(b)} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-wider rounded-xl text-[10px] flex items-center justify-center gap-1.5 shadow-sm transition">
                            <SplitSquareHorizontal className="w-4 h-4"/> Review & Split
                          </button>
                        )}

                        {!needsReview && needsPO && (
                          <>
                            <button onClick={() => setPoBatch(b)} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-wider rounded-xl text-[10px] flex items-center justify-center gap-1.5 shadow-sm transition">
                              <ShoppingCart className="w-4 h-4"/> Issue PO (Missing)
                            </button>
                            <button onClick={() => openReviewModal(b)} className="w-full py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-black uppercase tracking-wider rounded-xl text-[10px] flex items-center justify-center gap-1.5 shadow-sm transition">
                              <SplitSquareHorizontal className="w-3.5 h-3.5"/> Edit Decisions
                            </button>
                          </>
                        )}

                        {!needsReview && !needsPO && !isReadyForPickup && (
                          <button onClick={() => openReviewModal(b)} className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black uppercase tracking-wider rounded-xl text-[10px] flex items-center justify-center gap-1.5 border border-slate-200 transition">
                            <CheckCircle className="w-4 h-4"/> Re-Review Batch
                          </button>
                        )}
                      </>
                    )}
                    
                    {/* 1-Click Printable Gate Pass Button */}
                    <button 
                      onClick={() => generateDispatchSlip(b, userRole, { onlyAvailable: true })} 
                      className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black uppercase tracking-wider rounded-xl text-[10px] flex items-center justify-center gap-1.5 border border-slate-300 shadow-sm transition"
                    >
                      <Printer className="w-4 h-4 text-slate-600"/> Print Gate Slip
                    </button>

                    <button onClick={() => setChatBatch(b)} className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-black uppercase tracking-wider rounded-xl text-[10px] flex items-center justify-center gap-1.5 shadow-sm transition">
                      <MessageSquare className="w-4 h-4"/> Thread
                    </button>
                    
                    {userRole === 'SUPER_ADMIN' && viewMode === 'active' && (
                      <button onClick={() => setDeleteTarget(b)} className="w-full py-2.5 bg-white hover:bg-red-50 text-red-600 font-black uppercase tracking-wider rounded-xl border border-red-200 text-[10px] flex items-center justify-center shadow-sm transition">
                        <Trash2 className="w-4 h-4"/>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {poBatch && user && <VendorPOEngine batch={poBatch} userEmail={user.email || ''} onClose={() => setPoBatch(null)} onSuccess={() => { setPoBatch(null); fetchData(); }} />}
      {chatBatch && user && <BatchDetailsModal batchId={chatBatch.batch_id} workOrderId={chatBatch.id} isOpen={!!chatBatch} onClose={() => setChatBatch(null)} currentUser={user} />}
      
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

      {/* --- SMART REVIEW MODAL WITH STOCK DISPLAY & ADAPTIVE OPTIONS --- */}
      {reviewBatch && (
         <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
           <div className="bg-white rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[88vh]">
             <div className="bg-brand-maroon p-5 flex justify-between items-center text-white shrink-0">
               <div>
                 <h3 className="font-extrabold text-sm uppercase tracking-wide">Review Batch & Fulfill / Split</h3>
                 <p className="text-[11px] text-amber-200 font-medium">Batch: {reviewBatch.batch_id} • In-stock items will dispatch immediately</p>
               </div>
               <button onClick={() => setReviewBatch(null)} className="hover:text-red-200 transition"><X className="w-5 h-5"/></button>
             </div>

             <form onSubmit={handleReviewSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
               {reviewBatch.items
                 .filter(item => userRole === 'SUPER_ADMIN' || userRole === 'ADMIN' || item.fulfillment_dept === userRole)
                 .map(item => {
                   const physical = item.inventory?.physical_stock || 0;
                   const freezed = item.inventory?.freezed_stock || 0;
                   const availableStock = Math.max(0, physical - freezed);
                   const isCatalogItem = !!item.inventory_id;
                   const hasEnoughStock = isCatalogItem && availableStock >= item.requested_qty;
                   const isSubstituted = !!substitutedItems[item.id] || item.custom_item_name?.includes('[Alt for:');

                   return (
                     <div key={item.id} className="p-4 border border-slate-200 rounded-2xl grid grid-cols-1 md:grid-cols-12 gap-3 items-center bg-slate-50 shadow-sm">
                        <div className="md:col-span-5 space-y-1">
                          <div className="font-bold text-slate-800 text-sm">
                            {item.custom_item_name || item.inventory?.name}
                          </div>

                          <div className="flex items-center gap-2 text-[11px]">
                            <span className="text-slate-500 font-medium">Req: <strong className="text-brand-maroon font-black">{item.requested_qty}</strong></span>
                            <span className="text-slate-300">•</span>
                            {isCatalogItem ? (
                              <span className={`font-black px-1.5 py-0.5 rounded text-[10px] ${hasEnoughStock ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'}`}>
                                Stock Avail: {availableStock}
                              </span>
                            ) : (
                              <span className="bg-amber-100 text-amber-800 font-black px-1.5 py-0.5 rounded text-[10px]">
                                Custom (No Stock)
                              </span>
                            )}
                            {isSubstituted && (
                              <span className="bg-indigo-100 text-indigo-800 font-black px-1.5 py-0.5 rounded text-[10px]">
                                Substituted
                              </span>
                            )}
                          </div>

                          {/* Alternative Item trigger button */}
                          <button
                            type="button"
                            onClick={() => setAltModalTarget({
                              id: item.id,
                              name: item.custom_item_name || item.inventory?.name || 'Item',
                              qty: item.requested_qty,
                              dept: item.fulfillment_dept || userRole
                            })}
                            className="mt-1 text-[10px] font-black uppercase text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition"
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>{isCatalogItem && hasEnoughStock ? 'Swap Catalog SKU' : 'Select In-Stock Alternative'}</span>
                          </button>
                        </div>

                        <div className="md:col-span-4">
                          <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Decision</label>
                          <select 
                            value={itemDecisions[item.id]?.status || (hasEnoughStock ? 'Available' : 'Ordered')} 
                            onChange={e => setItemDecisions({
                              ...itemDecisions, 
                              [item.id]: { ...itemDecisions[item.id], status: e.target.value }
                            })} 
                            className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-brand-maroon"
                          >
                            {hasEnoughStock ? (
                              <>
                                <option value="Available">Available (Immediate Dispatch)</option>
                                <option value="Ordered">Order Anyway (Requires PO)</option>
                                <option value="Not Provided">Not Provided (Reject)</option>
                              </>
                            ) : (
                              <>
                                <option value="Ordered">Not in Stock (Requires PO)</option>
                                <option value="Available">Force Available (Physical Override)</option>
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
                                placeholder="ETA Days" 
                                value={itemDecisions[item.id]?.eta || ''} 
                                onChange={e => setItemDecisions({
                                  ...itemDecisions, 
                                  [item.id]: { ...itemDecisions[item.id], eta: parseInt(e.target.value) || 0 }
                                })} 
                                className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold outline-none text-center focus:ring-2 focus:ring-amber-500"
                              />
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
                     <span>Mixed Allocation Detected: In-stock items will be dispatched under <strong>{reviewBatch.batch_id}</strong> immediately. Out-of-stock items will automatically split into <strong>{reviewBatch.batch_id}-PO</strong> for purchase.</span>
                   </div>
                 </div>
               )}

               <button 
                 type="submit" 
                 disabled={!!processingId} 
                 className="w-full py-4 mt-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
               >
                 <span>Confirm Allocation & Complete Split</span>
                 <ArrowRight className="w-4 h-4" />
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
    </div>
  );
}