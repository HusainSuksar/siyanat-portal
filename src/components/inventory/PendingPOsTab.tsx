import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Truck, Printer, Clock, AlertTriangle, MessageSquare } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import { printPurchaseOrder } from '../../utils/printPurchaseOrder';

interface Props {
  pendingPOs: any[];
  role: string | undefined;
  onRefresh: () => void;
}

export default function PendingPOsTab({ pendingPOs, role, onRefresh }: Props) {
  const { showToast } = useToast();
  const [poConfirmTarget, setPoConfirmTarget] = useState<any>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fulfillPO = async () => {
    if (!poConfirmTarget) return;
    setProcessingId(poConfirmTarget.id);

    try {
      await supabase.from('purchase_orders').update({ status: 'Fulfilled & Received' }).eq('id', poConfirmTarget.id);

      const affectedWorkOrderIds = new Set<string>();

      for (const item of poConfirmTarget.items) {
        let targetInventoryId = item.inventory_id;
        
        if (!targetInventoryId && item.custom_item_name) {
          const { data: woItems } = await supabase.from('work_order_items')
            .select('id, work_order_id, requested_qty')
            .eq('custom_item_name', item.custom_item_name)
            .in('status', ['Ordered', 'Pending', 'PO Issued']);
            
          const totalReq = woItems?.reduce((sum, wi) => sum + wi.requested_qty, 0) || 0;
          woItems?.forEach(wi => affectedWorkOrderIds.add(wi.work_order_id));

          const { data: newInv } = await supabase.from('inventory_items').insert({
            item_id: `CAT-${Math.floor(10000 + Math.random() * 90000)}`,
            name: item.custom_item_name,
            category: 'General / Miscellaneous',
            physical_stock: item.requested_qty,
            freezed_stock: totalReq,
            unit: 'Pcs',
            fulfillment_dept: role?.includes('_HEAD') ? role : 'SIYANAT_HEAD',
            warehouse_location: 'Main Store'
          }).select().single();
          
          if (newInv && woItems && woItems.length > 0) {
            targetInventoryId = newInv.id;
            await supabase.from('work_order_items')
              .update({ status: 'Stock Injected', inventory_id: targetInventoryId })
              .in('id', woItems.map(wi => wi.id));
          }

        } else if (targetInventoryId) {
          const { data: inv } = await supabase.from('inventory_items').select('physical_stock, freezed_stock').eq('id', targetInventoryId).single();
          
          if (inv) {
            const { data: woItems } = await supabase.from('work_order_items')
              .select('id, work_order_id, requested_qty')
              .eq('inventory_id', targetInventoryId)
              .in('status', ['Ordered', 'Pending', 'PO Issued']);
              
            const newReq = woItems?.reduce((sum, wi) => sum + wi.requested_qty, 0) || 0;
            woItems?.forEach(wi => affectedWorkOrderIds.add(wi.work_order_id));

            await supabase.from('inventory_items').update({ 
              physical_stock: inv.physical_stock + item.requested_qty,
              freezed_stock: inv.freezed_stock + newReq
            }).eq('id', targetInventoryId);

            if (woItems && woItems.length > 0) {
              await supabase.from('work_order_items')
                .update({ status: 'Stock Injected' })
                .in('id', woItems.map(wi => wi.id));
            }
          }
        }
      }

      if (poConfirmTarget.complaint_id) {
        await supabase.from('technician_assignments').update({ status: 'Assigned' }).eq('complaint_id', poConfirmTarget.complaint_id);
        await supabase.from('complaints').update({ pipeline_state: 'PROCESSING' }).eq('id', poConfirmTarget.complaint_id);
      }

      for (const woId of Array.from(affectedWorkOrderIds)) {
        await supabase.from('work_orders')
          .update({ pipeline_state: 'ACTION_REQUIRED', dispatch_status: 'Ready for Collection' })
          .eq('id', woId);
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
                    {po.items.map((i: any) => (
                      <div key={i.id} className="text-xs font-bold text-slate-700 bg-white px-3 py-1.5 rounded-lg border border-slate-100 flex justify-between items-center">
                        <span>{i.custom_item_name || i.inventory?.name || 'Catalog Item'}</span>
                        <div className="flex items-center gap-3">
                          {i.unit_price > 0 && <span className="text-slate-400 text-[11px]">@ ₹{i.unit_price}</span>}
                          <span className="text-brand-maroon font-black">Qty: {i.requested_qty}</span>
                        </div>
                      </div>
                    ))}
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
                    onClick={() => setPoConfirmTarget(po)} 
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

      {/* Confirmation Modal */}
      {poConfirmTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden p-6 text-center">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Truck className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-black text-slate-800 mb-2">Receive PO {poConfirmTarget.po_number}?</h3>
            <p className="text-xs text-slate-500 mb-6">
              Confirming this delivery permanently updates physical warehouse inventory counts and marks the parent requisition as Ready for Collection.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setPoConfirmTarget(null)} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition">
                Cancel
              </button>
              <button onClick={fulfillPO} disabled={!!processingId} className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition disabled:opacity-50">
                Receive
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}