import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { ShoppingCart, X, FileText, PackagePlus } from 'lucide-react';
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
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // THE FIX: Map to track the elevated quantities being ordered
  const [orderQuantities, setOrderQuantities] = useState<Record<string, number>>({});
  
  // Only process items that the Head marked as "Ordered" during the Split phase
  const pendingItems = batch.items.filter(i => i.status === 'Ordered');

  useEffect(() => {
    const fetchVendors = async () => {
      const { data } = await supabase.from('vendors').select('*').eq('is_active', true).order('name');
      if (data) setVendors(data as Vendor[]);
    };
    fetchVendors();
    
    // Initialize order quantities with the Technician's base requested amount
    const initial: Record<string, number> = {};
    pendingItems.forEach(item => {
        initial[item.id] = item.requested_qty;
    });
    setOrderQuantities(initial);
  }, [batch, pendingItems]);

  const generatePO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVendorId) return;
    setIsProcessing(true);

    try {
      const itemsPayload = pendingItems.map(item => ({
        item_type: item.item_type,
        inventory_id: item.inventory_id,
        custom_item_name: item.custom_item_name,
        // Submitting the elevated quantity for the Vendor
        requested_qty: orderQuantities[item.id] 
      }));

      const { data: poNumber, error } = await supabase.rpc('generate_vendor_po', {
        p_batch_id: batch.id,
        p_vendor_id: selectedVendorId,
        p_technician_id: batch.requester?.id || null, 
        p_reason: batch.reason || '',
        p_items: itemsPayload,
        p_user_email: userEmail
      });

      if (error) throw error;

      showToast(`Official Purchase Order (${poNumber}) generated!`, 'success');
      onSuccess();
    } catch (err: any) {
      showToast('Error generating PO: ' + err.message, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="bg-indigo-600 p-5 flex justify-between items-center text-white">
          <h3 className="font-extrabold text-sm uppercase flex items-center gap-2"><ShoppingCart className="w-5 h-5"/> Generate Purchase Order</h3>
          <button onClick={onClose} className="hover:bg-white/20 p-1 rounded-lg transition"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={generatePO} className="p-6 space-y-5">
          
          <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex items-start gap-3">
             <PackagePlus className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
             <div>
               <p className="text-xs font-black text-indigo-900 mb-1 uppercase tracking-wide">Safety Stock Adjustment</p>
               <p className="text-[11px] font-bold text-indigo-700/80">
                 You may order more items than the Technician requested. The surplus will automatically be deposited into warehouse inventory when the shipment arrives.
               </p>
             </div>
          </div>

          <div className="max-h-60 overflow-y-auto space-y-3 mb-4">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Items to Order</h4>
            {pendingItems.map(item => (
              <div key={item.id} className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-200 shadow-sm">
                 <div>
                   <p className="text-xs font-bold text-slate-800">{item.inventory?.name || item.custom_item_name}</p>
                   <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Tech Requested: <span className="font-black text-brand-maroon">{item.requested_qty}</span></p>
                 </div>
                 <div className="w-24">
                   <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">Order Qty</label>
                   <input
                     type="number"
                     min={item.requested_qty} // Prevents ordering less than what the Tech requires
                     value={orderQuantities[item.id] || item.requested_qty}
                     onChange={e => setOrderQuantities({...orderQuantities, [item.id]: parseInt(e.target.value) || item.requested_qty})}
                     className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-black text-center outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                   />
                 </div>
              </div>
            ))}
          </div>

          <div>
            <label className="block text-[11px] font-black text-slate-500 uppercase mb-2">Select Approved Vendor *</label>
            <select required value={selectedVendorId} onChange={e => setSelectedVendorId(e.target.value)} className="w-full p-3.5 bg-white border border-slate-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm">
              <option value="" disabled>-- Choose External Vendor --</option>
              {vendors.map(v => <option key={v.id} value={v.id}>{v.name} ({v.category})</option>)}
            </select>
          </div>
          
          <button type="submit" disabled={isProcessing} className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-lg transition disabled:opacity-50 flex justify-center items-center gap-2">
            <FileText className="w-4 h-4" /> Issue Formal P.O. to Vendor
          </button>
        </form>
      </div>
    </div>
  );
}