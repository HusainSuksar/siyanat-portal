import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { ShoppingCart, X, FileText, PackagePlus, Building2 } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import type { WorkOrder } from '../../types';

interface Vendor { id: string; name: string; category: string; }

interface VendorPOEngineProps {
  batch: WorkOrder;
  userEmail: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function VendorPOEngine({ batch, userEmail, onClose, onSuccess }: VendorPOEngineProps) {
  const { showToast } = useToast();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Per-item state mappings
  const [itemVendors, setItemVendors] = useState<Record<string, string>>({});
  const [orderQuantities, setOrderQuantities] = useState<Record<string, number>>({});

  const pendingItems = batch.items.filter(i => ['Ordered', 'Pending'].includes(i.status));

  useEffect(() => {
    const fetchVendors = async () => {
      const { data } = await supabase.from('vendors').select('*').eq('is_active', true).order('name');
      if (data) {
        setVendors(data as Vendor[]);
        const defaultVendorId = data[0]?.id || '';
        const initialVendors: Record<string, string> = {};
        const initialQtys: Record<string, number> = {};

        batch.items.filter(i => ['Ordered', 'Pending'].includes(i.status)).forEach(item => {
          initialVendors[item.id] = defaultVendorId;
          initialQtys[item.id] = item.requested_qty;
        });

        setItemVendors(initialVendors);
        setOrderQuantities(initialQtys);
      }
    };
    fetchVendors();
  }, [batch.id]);

  const generatePOs = async (e: React.FormEvent) => {
    e.preventDefault();
    const unassigned = pendingItems.some(i => !itemVendors[i.id]);
    if (unassigned) return showToast('Please select a vendor for every item.', 'warning');

    setIsProcessing(true);

    try {
      const vendorGroups: Record<string, typeof pendingItems> = {};
      pendingItems.forEach(item => {
        const vId = itemVendors[item.id];
        if (!vendorGroups[vId]) vendorGroups[vId] = [];
        vendorGroups[vId].push(item);
      });

      const generatedPoNumbers: string[] = [];

      for (const [vendorId, items] of Object.entries(vendorGroups)) {
        const itemsPayload = items.map(item => ({
          item_id: item.id,
          item_type: item.item_type,
          inventory_id: item.inventory_id,
          custom_item_name: item.custom_item_name,
          requested_qty: orderQuantities[item.id] || item.requested_qty
        }));

        const { data: poNumber, error } = await supabase.rpc('generate_vendor_po', {
          p_batch_id: batch.id,
          p_vendor_id: vendorId,
          p_technician_id: batch.requester?.id || null, 
          p_reason: batch.reason || '',
          p_items: itemsPayload,
          p_user_email: userEmail
        });

        if (error) throw error;
        if (poNumber) generatedPoNumbers.push(poNumber);
      }

      showToast(`Generated ${generatedPoNumbers.length} PO(s): ${generatedPoNumbers.join(', ')}`, 'success');
      onSuccess();
    } catch (err: any) {
      showToast('Error generating POs: ' + err.message, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="bg-indigo-600 p-5 flex justify-between items-center text-white">
          <h3 className="font-extrabold text-sm uppercase flex items-center gap-2">
            <ShoppingCart className="w-5 h-5"/> Multi-Vendor Purchase Order Generator
          </h3>
          <button onClick={onClose} className="hover:bg-white/20 p-1 rounded-lg transition"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={generatePOs} className="p-6 space-y-5">
          <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex items-start gap-3">
             <PackagePlus className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
             <div>
               <p className="text-xs font-black text-indigo-900 mb-0.5 uppercase tracking-wide">Multi-Vendor Routing</p>
               <p className="text-[11px] font-bold text-indigo-700/80">
                 Assign different suppliers for each item. The system will automatically split and generate distinct PO numbers per vendor.
               </p>
             </div>
          </div>

          <div className="max-h-80 overflow-y-auto space-y-3 pr-1">
            {pendingItems.map((item, index) => (
              <div key={item.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                 <div className="flex-1">
                   <span className="text-[9px] font-black uppercase text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 mb-1 inline-block">Item {index + 1}</span>
                   <p className="text-xs font-bold text-slate-800">{item.inventory?.name || item.custom_item_name}</p>
                   <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">
                     Requested: <span className="text-brand-maroon font-black">{item.requested_qty}</span>
                   </p>
                 </div>

                 <div className="flex items-center gap-3 w-full md:w-auto">
                   <div className="flex-1 md:w-56">
                     <label className="block text-[9px] font-black text-slate-500 uppercase mb-1 flex items-center gap-1">
                       <Building2 className="w-3 h-3 text-slate-400" /> Vendor
                     </label>
                     <select
                       required
                       value={itemVendors[item.id] || ''}
                       onChange={e => setItemVendors({ ...itemVendors, [item.id]: e.target.value })}
                       className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                     >
                       <option value="" disabled>-- Select Vendor --</option>
                       {vendors.map(v => (
                         <option key={v.id} value={v.id}>{v.name} ({v.category})</option>
                       ))}
                     </select>
                   </div>

                   <div className="w-24">
                     <label className="block text-[9px] font-black text-slate-500 uppercase mb-1">Order Qty</label>
                     <input
                       type="number"
                       min={item.requested_qty}
                       value={orderQuantities[item.id] || item.requested_qty}
                       onChange={e => setOrderQuantities({ ...orderQuantities, [item.id]: parseInt(e.target.value) || item.requested_qty })}
                       className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-black text-center outline-none focus:ring-2 focus:ring-indigo-500"
                     />
                   </div>
                 </div>
              </div>
            ))}
          </div>
          
          <button 
            type="submit" 
            disabled={isProcessing || pendingItems.length === 0} 
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-lg transition disabled:opacity-50 flex justify-center items-center gap-2"
          >
            <FileText className="w-4 h-4" /> {isProcessing ? 'Generating Orders...' : 'Generate Split Purchase Orders'}
          </button>
        </form>
      </div>
    </div>
  );
}