import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { RefreshCw, Printer, CheckCircle, XCircle } from 'lucide-react';

export default function SiyanatOperations() {
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchQueue = async () => {
    setLoading(true);
    // Fetch work orders and their nested items (joining inventory_items for the name)
    const { data, error } = await supabase
      .from('work_orders')
      .select(`
        *,
        items:work_order_items (
          requested_qty,
          item_type,
          custom_item_name,
          inventory:inventory_items(name)
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
  }, []);

  const dispatchBatch = async (id: string) => {
    if (!confirm('Confirm material dispatch for this batch?')) return;
    setProcessingId(id);

    const { error } = await supabase
      .from('work_orders')
      .update({ dispatch_status: 'Dispatched' })
      .eq('id', id);

    if (!error) {
      alert('Batch dispatched successfully!');
      fetchQueue();
    } else {
      alert('Error updating dispatch status.');
    }
    setProcessingId(null);
  };

  const releaseBatch = async (id: string) => {
    if (!confirm('Are you sure you want to cancel and release this batch?')) return;
    setProcessingId(id);

    const { error } = await supabase
      .from('work_orders')
      .update({ approval_status: 'Cancelled', dispatch_status: 'Released' })
      .eq('id', id);

    if (!error) {
      alert('Batch cancelled and stock unreserved.');
      fetchQueue();
    }
    setProcessingId(null);
  };

  const printBatchSlip = (batch: any) => {
    // Generate an HTML string for the printable gate pass
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
                  // Summarize items for the column
                  const itemSummary = b.items?.map((i: any) => {
                    const name = i.item_type === 'Catalog' && i.inventory ? i.inventory.name : i.custom_item_name;
                    return `${name} (x${i.requested_qty})`;
                  }).join(', ');

                  return (
                    <tr key={b.id} className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-brand-maroon">{b.batch_id}</td>
                      <td className="p-3 font-semibold text-slate-800">{b.department}</td>
                      <td className="p-3 text-slate-600">{b.location}</td>
                      <td className="p-3 text-slate-600 font-medium max-w-xs truncate" title={itemSummary}>
                        {itemSummary}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded font-bold ${
                          b.dispatch_status === 'Dispatched' ? 'bg-emerald-100 text-emerald-800' :
                          b.dispatch_status === 'Released' ? 'bg-red-100 text-red-800' :
                          'bg-amber-100 text-amber-800'
                        }`}>
                          {b.dispatch_status}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                          {b.dispatch_status !== 'Dispatched' && b.dispatch_status !== 'Released' && (
                            <>
                              <button 
                                onClick={() => dispatchBatch(b.id)}
                                disabled={processingId === b.id}
                                className="px-2.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg text-[11px] shadow-sm transition flex items-center space-x-1 disabled:opacity-50"
                              >
                                <CheckCircle className="w-3 h-3" />
                                <span>Process</span>
                              </button>
                              <button 
                                onClick={() => releaseBatch(b.id)}
                                disabled={processingId === b.id}
                                className="px-2.5 py-1.5 bg-red-700 hover:bg-red-800 text-white font-bold rounded-lg text-[11px] shadow-sm transition flex items-center space-x-1 disabled:opacity-50"
                              >
                                <XCircle className="w-3 h-3" />
                                <span>Release</span>
                              </button>
                            </>
                          )}
                          <button 
                            onClick={() => printBatchSlip(b)}
                            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg text-[11px] shadow-sm transition flex items-center space-x-1"
                          >
                            <Printer className="w-3 h-3" />
                            <span>Slip</span>
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
    </div>
  );
}