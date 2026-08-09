import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { RefreshCw, Printer, CheckCircle, XCircle, MessageSquare, Truck } from 'lucide-react';
import BatchDetailsModal from '../components/BatchDetailsModal';

export default function SiyanatOperations() {
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  
  // Chat Modal State
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeBatch, setActiveBatch] = useState<any>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);

  const fetchQueue = async () => {
    setLoading(true);
    // Updated query to pull inventory_id and physical_stock for deduction logic
    const { data, error } = await supabase
      .from('work_orders')
      .select(`
        *,
        logs:work_order_logs(author_id),
        items:work_order_items (
          requested_qty,
          item_type,
          custom_item_name,
          inventory_id,
          inventory:inventory_items(id, name, physical_stock)
        )
      `)
      .order('created_at', { ascending: false });

    if (data && !error) {
      setBatches(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchQueue();
    supabase.auth.getUser().then(({ data }) => setCurrentUser(data.user));
  }, []);

  // STEP 1: APPROVAL LOGIC
  // STEP 1: APPROVAL LOGIC
  const approveBatch = async (id: string, batch_id_name: string) => {
    if (!confirm('Approve this requisition?')) return;
    setProcessingId(id);

    const { error } = await supabase
      .from('work_orders')
      .update({ approval_status: 'Approved' })
      .eq('id', id);

    if (!error) {
      // 🟢 INJECT AUDIT LOG HERE
      await supabase.from('system_logs').insert({
        action_type: 'BATCH_APPROVED',
        description: `Approved material requisition for ${batch_id_name}.`,
        user_email: currentUser?.email || 'Admin'
      });
      fetchQueue();
    } else {
      alert('Error updating approval status.');
    }
    setProcessingId(null);
  };

  const rejectBatch = async (id: string, batch_id_name: string) => {
    if (!confirm('Are you sure you want to REJECT this batch?')) return;
    setProcessingId(id);

    const { error } = await supabase
      .from('work_orders')
      .update({ approval_status: 'Rejected', dispatch_status: 'Cancelled' })
      .eq('id', id);

    if (!error) {
      // 🔴 INJECT AUDIT LOG HERE
      await supabase.from('system_logs').insert({
        action_type: 'BATCH_REJECTED',
        description: `Rejected and cancelled requisition for ${batch_id_name}.`,
        user_email: currentUser?.email || 'Admin'
      });
      fetchQueue();
    }
    setProcessingId(null);
  };

  // STEP 2: DISPATCH & INVENTORY DEDUCTION LOGIC
  const dispatchBatch = async (batch: any) => {
    if (!confirm('Confirm material dispatch? This will permanently deduct items from the warehouse inventory.')) return;
    setProcessingId(batch.id);

    try {
      const catalogItems = batch.items.filter((i: any) => i.item_type === 'Catalog');

      for (const item of catalogItems) {
        if (!item.inventory_id) continue;
        const { data: invData, error: invError } = await supabase
          .from('inventory_items').select('physical_stock, name').eq('id', item.inventory_id).single();

        if (invError) throw new Error(`Could not verify stock for ${item.inventory.name}`);
        if (invData.physical_stock < item.requested_qty) {
          throw new Error(`Insufficient stock for ${invData.name}. Available: ${invData.physical_stock}, Requested: ${item.requested_qty}`);
        }

        const newStock = invData.physical_stock - item.requested_qty;
        const { error: updateError } = await supabase
          .from('inventory_items').update({ physical_stock: newStock }).eq('id', item.inventory_id);

        if (updateError) throw new Error(`Failed to deduct stock for ${invData.name}`);
      }

      const { error: dispatchError } = await supabase
        .from('work_orders').update({ dispatch_status: 'Dispatched' }).eq('id', batch.id);

      if (dispatchError) throw dispatchError;

      // 🔵 INJECT AUDIT LOG HERE
      await supabase.from('system_logs').insert({
        action_type: 'STOCK_DISPATCHED',
        description: `Dispatched ${batch.batch_id} and deducted corresponding physical inventory.`,
        user_email: currentUser?.email || 'Admin'
      });

      alert('Batch dispatched and inventory updated successfully!');
      fetchQueue();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const printBatchSlip = (batch: any) => {
    const itemsHtml = batch.items.map((item: any) => {
      const itemName = item.item_type === 'Catalog' && item.inventory 
        ? item.inventory.name 
        : item.custom_item_name;
      return `<tr>
        <td style="padding: 8px; border: 1px solid #000;">${itemName}</td>
        <td style="padding: 8px; border: 1px solid #000; font-weight: bold; text-align: center;">${item.requested_qty}</td>
      </tr>`;
    }).join("");

    const slipWindow = window.open('', '_blank');
    if (!slipWindow) return;

    slipWindow.document.write(`
      <html>
        <head>
          <title>Delivery Slip - ${batch.batch_id}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; color: #000; }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th { border: 1px solid #000; padding: 8px; text-align: left; background: #f0f0f0; }
            .signatures { display: flex; justify-content: space-between; margin-top: 80px; }
            .sig-box { border-top: 1px solid #000; width: 40%; text-align: center; padding-top: 5px; font-weight: bold; font-size: 12px; }
          </style>
        </head>
        <body onload="window.print();">
          <div class="header">
            <h2 style="margin: 0; color: #581c28;">SIYANAT UL MUMTALEKAAT</h2>
            <h3 style="margin: 5px 0;">Al Jamea tus Saifiyah - Siddhpur</h3>
            <h4 style="margin: 5px 0; text-decoration: underline;">MATERIAL GATE PASS</h4>
          </div>
          <p><strong>Batch Reference:</strong> ${batch.batch_id}</p>
          <p><strong>Department:</strong> ${batch.department}</p>
          <p><strong>Delivery Location:</strong> ${batch.location}</p>
          <p><strong>Date:</strong> ${new Date(batch.created_at).toLocaleDateString()}</p>
          <table>
            <thead><tr><th>Item Description</th><th style="text-align: center;">Qty Issued</th></tr></thead>
            <tbody>${itemsHtml}</tbody>
          </table>
          <div class="signatures">
            <div class="sig-box">Store Keeper / Issuer Sign</div>
            <div class="sig-box">Receiver Sign</div>
          </div>
        </body>
      </html>
    `);
    slipWindow.document.close();
  };

  const openChat = (batch: any) => {
    setActiveBatch(batch);
    setIsChatOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 space-y-4">
        <div className="flex justify-between items-center border-b pb-3">
          <h2 className="font-extrabold text-sm uppercase text-slate-800">Active Dispatch Queue</h2>
          <button 
            onClick={fetchQueue}
            className="text-xs text-brand-maroon font-bold flex items-center space-x-1 hover:text-brand-dark transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Queue</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 uppercase font-bold">
              <tr>
                <th className="p-3">Batch ID</th>
                <th className="p-3">Department</th>
                <th className="p-3">Location</th>
                <th className="p-3">Items Summary</th>
                <th className="p-3">Dispatch Status</th>
                <th className="p-3 text-right">Batch Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {batches.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-slate-500">
                    {loading ? 'Loading queue...' : 'No active batches in queue.'}
                  </td>
                </tr>
              ) : (
                batches.map(b => {
                  const itemSummary = b.items?.map((i: any) => {
                    const name = i.item_type === 'Catalog' && i.inventory ? i.inventory.name : i.custom_item_name;
                    return `${name} (x${i.requested_qty})`;
                  }).join(', ');

                  const logs = b.logs || [];
                  const hasUnread = logs.length > 0 && logs[logs.length - 1].author_id !== currentUser?.id;

                  return (
                    <tr key={b.id} className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-brand-maroon">{b.batch_id}</td>
                      <td className="p-3 font-semibold text-slate-800">{b.department}</td>
                      <td className="p-3 text-slate-600">{b.location}</td>
                      <td className="p-3 text-slate-600 font-medium max-w-xs truncate" title={itemSummary}>
                        {itemSummary}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-col space-y-1 items-start">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            b.approval_status === 'Approved' ? 'bg-emerald-100 text-emerald-800' :
                            b.approval_status === 'Rejected' ? 'bg-red-100 text-red-800' :
                            'bg-amber-100 text-amber-800'
                          }`}>
                            {b.approval_status}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            b.dispatch_status === 'Dispatched' ? 'bg-emerald-100 text-emerald-800' :
                            b.dispatch_status === 'Cancelled' ? 'bg-slate-200 text-slate-600' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {b.dispatch_status}
                          </span>
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                          
                          {/* STEP 1: APPROVAL BUTTONS */}
                          {b.approval_status === 'Pending Approval' && (
                            <>
                              <button 
                                onClick={() => approveBatch(b.id, b.batch_id)}
                                disabled={processingId === b.id}
                                className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[11px] shadow-sm transition flex items-center space-x-1 disabled:opacity-50"
                              >
                                <CheckCircle className="w-3 h-3" />
                                <span className="hidden sm:inline">Approve</span>
                              </button>
                              <button 
                                onClick={() => rejectBatch(b.id, b.batch_id)}
                                disabled={processingId === b.id}
                                className="px-2.5 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-[11px] shadow-sm transition flex items-center space-x-1 disabled:opacity-50"
                              >
                                <XCircle className="w-3 h-3" />
                                <span className="hidden sm:inline">Reject</span>
                              </button>
                            </>
                          )}

                          {/* STEP 2: DISPATCH BUTTON (Only shows if Approved and Not Dispatched) */}
                          {b.approval_status === 'Approved' && b.dispatch_status === 'Pending' && (
                            <button 
                              onClick={() => dispatchBatch(b)}
                              disabled={processingId === b.id}
                              className="px-2.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-lg text-[11px] shadow-sm transition flex items-center space-x-1 disabled:opacity-50"
                            >
                              <Truck className="w-3 h-3" />
                              <span className="hidden sm:inline">Dispatch</span>
                            </button>
                          )}

                          <button 
                            onClick={() => openChat(b)}
                            className="relative px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-[11px] shadow-sm transition flex items-center space-x-1"
                          >
                            {hasUnread && (
                              <span className="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-500 border-2 border-white"></span>
                              </span>
                            )}
                            <MessageSquare className="w-3 h-3" />
                            <span className="hidden sm:inline">Chat</span>
                          </button>
                          <button 
                            onClick={() => printBatchSlip(b)}
                            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg text-[11px] shadow-sm transition flex items-center space-x-1"
                          >
                            <Printer className="w-3 h-3" />
                            <span className="hidden sm:inline">Slip</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slide-out Chat Modal */}
      {activeBatch && currentUser && (
        <BatchDetailsModal
          batchId={activeBatch.batch_id}
          workOrderId={activeBatch.id}
          isOpen={isChatOpen}
          onClose={() => {
            setIsChatOpen(false);
            setActiveBatch(null);
            fetchQueue(); // Refresh logs to clear notification dot
          }}
          currentUser={currentUser}
        />
      )}
    </div>
  );
}