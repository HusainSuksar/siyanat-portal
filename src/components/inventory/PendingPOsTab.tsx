import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Truck, 
  Printer, 
  Clock, 
  AlertTriangle, 
  MessageSquare, 
  ArrowRightLeft, 
  CheckCircle2, 
  X, 
  PackageCheck, 
  AlertCircle,
  Loader2,
  Check
} from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { printPurchaseOrder } from '../../utils/printPurchaseOrder';

interface Props {
  pendingPOs: any[];
  role: string | undefined;
  onRefresh: () => void;
}

export default function PendingPOsTab({ pendingPOs, role, onRefresh }: Props) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [poConfirmTarget, setPoConfirmTarget] = useState<any>(null);
  const [receivedQtys, setReceivedQtys] = useState<Record<string, number>>({});
  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleOpenReceiveModal = (po: any) => {
    const initialQtys: Record<string, number> = {};
    po.items?.forEach((item: any, idx: number) => {
      const key = item.id || `item-${idx}`;
      initialQtys[key] = Number(item.requested_qty) || 1;
    });
    setReceivedQtys(initialQtys);
    setPoConfirmTarget(po);
  };

  const handleQtyChange = (key: string, value: string) => {
    const parsed = parseInt(value, 10);
    const validVal = isNaN(parsed) ? 0 : Math.max(0, parsed);
    setReceivedQtys(prev => ({ ...prev, [key]: validVal }));
  };

  const setAllFull = () => {
    if (!poConfirmTarget) return;
    const full: Record<string, number> = {};
    poConfirmTarget.items?.forEach((item: any, idx: number) => {
      const key = item.id || `item-${idx}`;
      full[key] = Number(item.requested_qty) || 1;
    });
    setReceivedQtys(full);
  };

  const fulfillPO = async () => {
    if (!poConfirmTarget) return;
    setProcessingId(poConfirmTarget.id);

    try {
      const { error: poErr } = await supabase
        .from('purchase_orders')
        .update({ status: 'Fulfilled & Received' })
        .eq('id', poConfirmTarget.id);
      if (poErr) throw poErr;

      const affectedWorkOrderIds = new Set<string>();
      const discrepancies: string[] = [];

      for (let idx = 0; idx < poConfirmTarget.items.length; idx++) {
        const item = poConfirmTarget.items[idx];
        const itemKey = item.id || `item-${idx}`;
        const orderedQty = Number(item.requested_qty) || 0;
        const verifiedReceivedQty = receivedQtys[itemKey] !== undefined ? Math.max(0, Number(receivedQtys[itemKey])) : orderedQty;
        const itemName = item.custom_item_name || item.inventory?.name || item.inventory_items?.name || 'Catalog Item';

        if (verifiedReceivedQty !== orderedQty) {
          discrepancies.push(`${itemName}: ordered ${orderedQty}, received ${verifiedReceivedQty} (${verifiedReceivedQty > orderedQty ? 'Surplus' : 'Shortfall'})`);
        }

        let targetInventoryId = item.inventory_id;
        
        if (!targetInventoryId && item.custom_item_name) {
          const { data: woItems, error: woFetchErr } = await supabase.from('work_order_items')
            .select('id, work_order_id, requested_qty')
            .eq('custom_item_name', item.custom_item_name)
            .in('status', ['Ordered', 'Pending', 'PO Issued']);
          if (woFetchErr) throw woFetchErr;
            
          const totalReq = woItems?.reduce((sum, wi) => sum + wi.requested_qty, 0) || 0;
          woItems?.forEach(wi => affectedWorkOrderIds.add(wi.work_order_id));

          const { data: newInv, error: invInsertErr } = await supabase.from('inventory_items').insert({
            item_id: `CAT-${Math.floor(10000 + Math.random() * 90000)}`,
            name: item.custom_item_name,
            category: 'General / Miscellaneous',
            physical_stock: verifiedReceivedQty,
            freezed_stock: Math.min(verifiedReceivedQty, totalReq),
            unit: 'Pcs',
            fulfillment_dept: role?.includes('_HEAD') ? role : 'SIYANAT_HEAD',
            warehouse_location: 'Main Store'
          }).select().single();
          if (invInsertErr) throw invInsertErr;
          
          if (newInv && woItems && woItems.length > 0) {
            targetInventoryId = newInv.id;
            const { error: woUpdateErr } = await supabase.from('work_order_items')
              .update({ status: 'Stock Injected', inventory_id: targetInventoryId })
              .in('id', woItems.map(wi => wi.id));
            if (woUpdateErr) throw woUpdateErr;
          }

        } else if (targetInventoryId) {
          const { data: woItems, error: woFetchErr } = await supabase.from('work_order_items')
            .select('id, work_order_id, requested_qty')
            .eq('inventory_id', targetInventoryId)
            .in('status', ['Ordered', 'Pending', 'PO Issued']);
          if (woFetchErr) throw woFetchErr;
            
          const newReq = woItems?.reduce((sum, wi) => sum + wi.requested_qty, 0) || 0;
          woItems?.forEach(wi => affectedWorkOrderIds.add(wi.work_order_id));

          const { error: rpcErr } = await supabase.rpc('increment_inventory_and_freeze_stock', {
            p_item_id: targetInventoryId,
            p_physical_delta: verifiedReceivedQty,
            p_freezed_delta: Math.min(verifiedReceivedQty, newReq)
          });
          if (rpcErr) throw rpcErr;

          if (woItems && woItems.length > 0) {
            const { error: woUpdateErr } = await supabase.from('work_order_items')
              .update({ status: 'Stock Injected' })
              .in('id', woItems.map(wi => wi.id));
            if (woUpdateErr) throw woUpdateErr;
          }
        }
      }

      // Log delivery receipt and discrepancies to system_logs
      await supabase.from('system_logs').insert({
        action_type: 'PO_DELIVERY_RECEIVED',
        description: `PO ${poConfirmTarget.po_number} received from ${poConfirmTarget.vendor?.name || 'Vendor'}. Items verified: ${poConfirmTarget.items.length}.${discrepancies.length > 0 ? ' Discrepancies noted: ' + discrepancies.join('; ') : ' All items received in full as ordered.'}`,
        user_email: user?.email || role || 'Storekeeper'
      });

      // Log delivery notice in work_order_logs for affected work orders
      for (const woId of Array.from(affectedWorkOrderIds)) {
        await supabase.from('work_order_logs').insert({
          work_order_id: woId,
          author_id: user?.id,
          message: `📦 Shipment received from PO ${poConfirmTarget.po_number} (${poConfirmTarget.vendor?.name || 'Vendor'}). Items injected into warehouse stock.`
        });
      }

      let targetComplaintId = poConfirmTarget.complaint_id;

      // Fallback: If not directly on PO, resolve from batch_id / work_order_id if linked
      if (!targetComplaintId && (poConfirmTarget.batch_id || poConfirmTarget.work_order_id)) {
        const targetWoId = poConfirmTarget.work_order_id || poConfirmTarget.batch_id;
        const { data: linkedWo } = await supabase
          .from('work_orders')
          .select('reason')
          .eq('id', targetWoId)
          .maybeSingle();

        if (linkedWo?.reason) {
          const match = linkedWo.reason.match(/Complaint:\s*([A-Za-z0-9_-]+)/i);
          if (match && match[1]) {
            const code = match[1].trim();
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(code);
            if (isUuid) {
              targetComplaintId = code;
            } else {
              const { data: comp } = await supabase.from('complaints').select('id').eq('complaint_id', code).maybeSingle();
              if (comp) targetComplaintId = comp.id;
            }
          }
        }

        if (targetComplaintId) {
          await supabase.from('purchase_orders').update({ complaint_id: targetComplaintId }).eq('id', poConfirmTarget.id);
        }
      }

      if (targetComplaintId) {
        const { error: assignErr } = await supabase
          .from('technician_assignments')
          .update({ status: 'Assigned' })
          .eq('complaint_id', targetComplaintId);
        if (assignErr) throw assignErr;

        const { error: compErr } = await supabase
          .from('complaints')
          .update({ pipeline_state: 'PROCESSING' })
          .eq('id', targetComplaintId);
        if (compErr) throw compErr;
      }

      for (const woId of Array.from(affectedWorkOrderIds)) {
        const { error: woStateErr } = await supabase.from('work_orders')
          .update({ pipeline_state: 'ACTION_REQUIRED', dispatch_status: 'Ready for Collection' })
          .eq('id', woId);
        if (woStateErr) throw woStateErr;
      }

      showToast(`PO ${poConfirmTarget.po_number} received & warehouse stock updated!`, "success");
      setPoConfirmTarget(null);
      onRefresh();
    } catch (err: any) {
      showToast("Error fulfilling PO: " + err.message, "error");
    } finally {
      setProcessingId(null);
    }
  };

  const openWhatsAppNotice = (po: any) => {
    const text = `*OFFICIAL PURCHASE ORDER ISSUED* 📄\n\n`
      + `*PO Number:* ${po.po_number}\n`
      + `*Supplier:* ${po.vendor?.name}\n`
      + `*Committed Amount:* ₹${(po.total_amount || 0).toFixed(2)}\n`
      + `*Payment Terms:* ${po.payment_terms || 'Immediate / COD'}\n`
      + `*Expected Delivery:* ${po.expected_delivery_date ? new Date(po.expected_delivery_date).toLocaleDateString('en-GB') : 'Immediate'}\n\n`
      + `_Please dispatch the requested items at the earliest. Thank you._`;

    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="bg-white rounded-3xl p-5 md:p-8 shadow-sm border border-slate-200 space-y-5">
      <div className="border-b border-slate-100 pb-4">
        <h3 className="font-black text-sm uppercase tracking-wide text-slate-800">Pending Purchase Orders (Receiving Dock)</h3>
        <p className="text-xs font-bold text-slate-400 mt-1">Track vendor delivery SLAs, print official orders, and receive incoming inventory.</p>
      </div>

      <div className="space-y-4">
        {pendingPOs.length === 0 ? (
          <div className="p-12 text-center text-slate-400 font-bold italic bg-slate-50 rounded-2xl border border-slate-100">
            No pending purchase orders waiting for delivery.
          </div>
        ) : (
          pendingPOs.map(po => {
            const isOverdue = po.expected_delivery_date && new Date(po.expected_delivery_date) < new Date();

            return (
              <div key={po.id} className={`bg-slate-50 rounded-2xl p-5 border shadow-sm flex flex-col md:flex-row justify-between gap-5 transition ${isOverdue ? 'border-amber-300 bg-amber-50/20' : 'border-slate-200'}`}>
                <div className="space-y-3 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-black text-brand-maroon text-base">{po.po_number}</h4>
                    <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-800 text-[9px] font-black uppercase tracking-wider rounded border border-indigo-200">{po.status}</span>
                    
                    {isOverdue ? (
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[9px] font-black uppercase tracking-wider rounded flex items-center gap-1 border border-red-200">
                        <AlertTriangle className="w-3 h-3" /> Overdue SLA
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-slate-200 text-slate-700 text-[9px] font-bold uppercase tracking-wider rounded flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Expected: {po.expected_delivery_date ? new Date(po.expected_delivery_date).toLocaleDateString('en-GB') : 'Immediate'}
                      </span>
                    )}

                    {po.total_amount > 0 && (
                      <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded border border-emerald-200 ml-auto md:ml-0">
                        Total: ₹{po.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-3.5 rounded-xl border border-slate-100 text-xs">
                    <div>
                      <span className="text-[10px] font-black uppercase text-slate-400 block">Vendor:</span>
                      <p className="font-bold text-slate-800">{po.vendor?.name || 'External Vendor'}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase text-slate-400 block">Terms:</span>
                      <p className="font-bold text-slate-800">{po.payment_terms || 'Immediate / COD'}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase text-slate-400 block">Requested For:</span>
                      <p className="font-bold text-slate-800">{po.technician?.full_name || 'Department Requisition'}</p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase text-slate-400">Ordered Items:</span>
                    {po.items.map((i: any) => {
                      const isSub = Boolean(i.custom_item_name && i.custom_item_name.includes('[Alt for:'));
                      return (
                        <div key={i.id} className="text-xs font-bold text-slate-700 bg-white px-3 py-1.5 rounded-lg border border-slate-100 flex justify-between items-center">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span>{i.custom_item_name || i.inventory?.name || 'Catalog Item'}</span>
                            {isSub && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[9px] font-black uppercase tracking-wider">
                                <ArrowRightLeft className="w-2.5 h-2.5 text-amber-600" /> Substituted
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            {i.unit_price > 0 && <span className="text-slate-400 text-[11px]">@ ₹{i.unit_price}</span>}
                            <span className="text-brand-maroon font-black">Qty: {i.requested_qty}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Operations Actions */}
                <div className="flex flex-col sm:flex-row md:flex-col justify-center gap-2 shrink-0">
                  <button 
                    onClick={() => printPurchaseOrder(po)}
                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow transition flex items-center justify-center gap-1.5"
                  >
                    <Printer className="w-3.5 h-3.5" /> Print PO Slip
                  </button>

                  <button 
                    onClick={() => openWhatsAppNotice(po)}
                    className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs rounded-xl border border-emerald-200 transition flex items-center justify-center gap-1.5"
                  >
                    <MessageSquare className="w-3.5 h-3.5" /> WhatsApp Notice
                  </button>

                  <button 
                    onClick={() => handleOpenReceiveModal(po)} 
                    disabled={processingId === po.id} 
                    className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-lg transition flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Truck className="w-4 h-4" /> Receive Delivery
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Interactive Receiving Dock Checklist Modal */}
      {poConfirmTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex justify-center items-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center shrink-0 shadow-sm">
                  <PackageCheck className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-slate-800">Receiving Dock Inspection</h3>
                    <span className="px-2 py-0.5 bg-brand-maroon/10 text-brand-maroon text-[10px] font-black rounded-full">
                      {poConfirmTarget.po_number}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium">Verify physical items received and adjust counts before injecting stock.</p>
                </div>
              </div>
              <button 
                onClick={() => setPoConfirmTarget(null)}
                className="w-8 h-8 rounded-full hover:bg-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* PO Metadata Summary Banner */}
            <div className="px-6 py-3 bg-slate-100/60 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-4 flex-wrap">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Vendor</span>
                  <span className="font-bold text-slate-800">{poConfirmTarget.vendor?.name || 'External Vendor'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Terms</span>
                  <span className="font-bold text-slate-800">{poConfirmTarget.payment_terms || 'Immediate / COD'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Expected</span>
                  <span className="font-bold text-slate-800">
                    {poConfirmTarget.expected_delivery_date ? new Date(poConfirmTarget.expected_delivery_date).toLocaleDateString('en-GB') : 'Immediate'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={setAllFull}
                className="px-2.5 py-1 bg-white hover:bg-emerald-50 text-emerald-700 font-black text-[10px] uppercase tracking-wider rounded-lg border border-emerald-200 shadow-sm transition flex items-center gap-1 ml-auto"
              >
                <Check className="w-3 h-3" /> Mark All Full
              </button>
            </div>

            {/* Line Items Checklist */}
            <div className="p-6 overflow-y-auto space-y-3 flex-1">
              <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-slate-400 px-1">
                <span>Delivered Item Description</span>
                <span className="pr-2">Verify Received Qty</span>
              </div>

              {poConfirmTarget.items?.map((item: any, idx: number) => {
                const itemKey = item.id || `item-${idx}`;
                const orderedQty = Number(item.requested_qty) || 0;
                const receivedQty = receivedQtys[itemKey] !== undefined ? receivedQtys[itemKey] : orderedQty;
                
                const isSubstituted = Boolean(item.custom_item_name && item.custom_item_name.includes('[Alt for:'));
                let originalName: string | null = null;
                let displayName = item.custom_item_name || item.inventory?.name || item.inventory_items?.name || 'Catalog Item';

                if (isSubstituted && item.custom_item_name) {
                  const match = item.custom_item_name.match(/\[Alt for:\s*([^\]]+)\]\s*(.*)/);
                  if (match) {
                    originalName = match[1].trim();
                    displayName = match[2].trim() || item.custom_item_name;
                  }
                }

                const isExact = receivedQty === orderedQty;
                const isZero = receivedQty === 0;
                const isShortfall = receivedQty < orderedQty && receivedQty > 0;
                const isSurplus = receivedQty > orderedQty;

                return (
                  <div 
                    key={itemKey} 
                    className={`p-4 rounded-2xl border transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                      isZero ? 'bg-red-50/40 border-red-200' :
                      isShortfall ? 'bg-amber-50/40 border-amber-200' :
                      isSurplus ? 'bg-blue-50/40 border-blue-200' :
                      'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-sm text-slate-800 break-words">{displayName}</span>
                        {isSubstituted && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-black uppercase tracking-wider">
                            <ArrowRightLeft className="w-2.5 h-2.5 text-amber-600" /> Substituted
                          </span>
                        )}
                        {!item.inventory_id && !isSubstituted && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 text-[9px] font-bold">
                            Custom Item
                          </span>
                        )}
                      </div>

                      {originalName && (
                        <p className="text-[11px] text-amber-800 font-medium">
                          Original requested: <span className="font-bold line-through">{originalName}</span>
                        </p>
                      )}

                      <div className="flex items-center gap-3 text-xs text-slate-500 font-semibold">
                        <span>Ordered: <strong className="text-slate-800">{orderedQty} units</strong></span>
                        {item.unit_price > 0 && (
                          <span>Rate: ₹{item.unit_price}</span>
                        )}
                      </div>
                    </div>

                    {/* Quantity Adjustment Controls */}
                    <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min="0"
                          value={receivedQty}
                          onChange={(e) => handleQtyChange(itemKey, e.target.value)}
                          className="w-20 px-2.5 py-2 text-center font-black text-sm bg-white border border-slate-300 rounded-xl shadow-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none"
                        />
                        <span className="text-xs font-bold text-slate-500">units</span>
                      </div>

                      {/* Status indicator pill */}
                      <div className="w-28 text-right">
                        {isExact && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-lg">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Full Match
                          </span>
                        )}
                        {isZero && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-800 text-[10px] font-black rounded-lg">
                            <AlertCircle className="w-3 h-3 text-red-600" /> Missing (0)
                          </span>
                        )}
                        {isShortfall && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-900 text-[10px] font-black rounded-lg">
                            <AlertTriangle className="w-3 h-3 text-amber-600" /> Short (-{orderedQty - receivedQty})
                          </span>
                        )}
                        {isSurplus && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-900 text-[10px] font-black rounded-lg">
                            Surplus (+{receivedQty - orderedQty})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-slate-200 bg-slate-50 space-y-4">
              {/* Discrepancy warning if any */}
              {(() => {
                const totalOrdered = poConfirmTarget.items?.reduce((sum: number, it: any) => sum + (Number(it.requested_qty) || 0), 0) || 0;
                const totalReceived = poConfirmTarget.items?.reduce((sum: number, it: any, idx: number) => {
                  const key = it.id || `item-${idx}`;
                  const r = receivedQtys[key] !== undefined ? receivedQtys[key] : (Number(it.requested_qty) || 0);
                  return sum + r;
                }, 0) || 0;
                const hasDiscrepancy = totalOrdered !== totalReceived;

                return (
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      {hasDiscrepancy ? (
                        <div className="flex items-center gap-1.5 text-amber-800 font-bold">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>Delivery discrepancy will be recorded in audit logs.</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-emerald-800 font-bold">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>All ordered line items verified in full.</span>
                        </div>
                      )}
                    </div>
                    <div className="text-right text-xs font-bold text-slate-600">
                      Total Ordered: <strong className="text-slate-800">{totalOrdered}</strong> | Receiving: <strong className="text-emerald-700">{totalReceived} units</strong>
                    </div>
                  </div>
                );
              })()}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setPoConfirmTarget(null)}
                  disabled={!!processingId}
                  className="flex-1 py-3 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-black text-xs uppercase tracking-wider rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={fulfillPO}
                  disabled={!!processingId}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {processingId === poConfirmTarget.id ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Receiving & Updating Stock...
                    </>
                  ) : (
                    <>
                      <PackageCheck className="w-4 h-4" />
                      Confirm Delivery & Inject Stock
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}