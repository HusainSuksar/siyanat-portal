import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/useToast';
import { X, Plus, Trash2, ShoppingBag } from 'lucide-react';
import { printPurchaseOrder } from '../../utils/printPurchaseOrder';

interface DirectItem {
  id: string;
  name: string;
  qty: number;
  rate: number;
  unit: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function DirectPOModal({ isOpen, onClose, onSuccess }: Props) {
  const { user, profile } = useAuth();
  const { showToast } = useToast();

  const [vendors, setVendors] = useState<any[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('Immediate / COD');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [taxRate, setTaxRate] = useState(18);
  const [submitting, setSubmitting] = useState(false);

  const [items, setItems] = useState<DirectItem[]>([
    { id: crypto.randomUUID(), name: '', qty: 1, rate: 0, unit: 'Pcs' }
  ]);

  useEffect(() => {
    if (!isOpen) return;
    const fetchVendors = async () => {
      const { data } = await supabase
        .from('vendors')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (data) {
        setVendors(data);
        if (data.length > 0) setSelectedVendorId(data[0].id);
      }
    };
    fetchVendors();
  }, [isOpen]);

  const addItemRow = () => {
    setItems(prev => [
      ...prev,
      { id: crypto.randomUUID(), name: '', qty: 1, rate: 0, unit: 'Pcs' }
    ]);
  };

  const removeItemRow = (id: string) => {
    if (items.length === 1) return;
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const updateItem = (id: string, field: keyof DirectItem, value: any) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  // Calculations
  const subtotal = items.reduce((sum, item) => sum + (Number(item.qty || 0) * Number(item.rate || 0)), 0);
  const taxAmount = (subtotal * Number(taxRate || 0)) / 100;
  const grandTotal = subtotal + taxAmount;

  const handleGenerateDirectPO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVendorId) return showToast('Please select a vendor.', 'error');
    if (items.some(i => !i.name.trim() || i.qty <= 0)) {
      return showToast('Ensure all items have valid names and quantities.', 'error');
    }

    setSubmitting(true);
    try {
      const poNumber = `PO-DIR-${Math.floor(10000 + Math.random() * 90000)}`;

      // Format line items matching PendingPOsTab structure
      const formattedItems = items.map(item => ({
        custom_item_name: item.name.trim(),
        requested_qty: Number(item.qty),
        unit_price: Number(item.rate),
        unit: item.unit || 'Pcs'
      }));

      const payload = {
        po_number: poNumber,
        vendor_id: selectedVendorId,
        authorizer_id: user?.id,
        status: 'PO Issued',
        payment_terms: paymentTerms,
        expected_delivery_date: expectedDeliveryDate || null,
        subtotal,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        total_amount: grandTotal,
        items: formattedItems
      };

      const { data: newPO, error } = await supabase
        .from('purchase_orders')
        .insert(payload)
        .select(`*, vendor:vendors(name, contact_info, category)`)
        .single();

      if (error) throw error;

      await supabase.from('system_logs').insert({
        action_type: 'DIRECT_PO_CREATED',
        description: `Direct Purchase Order ${poNumber} issued for ₹${grandTotal.toFixed(2)}.`,
        user_email: user?.email || 'Admin'
      });

      showToast(`Direct PO ${poNumber} generated successfully!`, 'success');

      // Auto-print popup
      const activeVendor = vendors.find(v => v.id === selectedVendorId);
      printPurchaseOrder(newPO, activeVendor, profile);

      onSuccess();
      onClose();
    } catch (err: any) {
      showToast('Error issuing Direct PO: ' + err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex justify-center items-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95">
        
        {/* Header */}
        <div className="bg-slate-900 p-5 flex justify-between items-center text-white shrink-0">
          <div className="flex items-center gap-2.5">
            <ShoppingBag className="w-5 h-5 text-brand-gold" />
            <div>
              <h3 className="font-extrabold text-sm uppercase tracking-wide">Generate Direct Purchase Order</h3>
              <p className="text-[10px] text-slate-400">Procure buffer stock or uncataloged items directly</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg transition">
            <X className="w-5 h-5 text-slate-400 hover:text-white" />
          </button>
        </div>

        {/* Scrollable Form */}
        <form onSubmit={handleGenerateDirectPO} className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Vendor & Logistics Meta */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Select Supplier *</label>
              <select
                required
                value={selectedVendorId}
                onChange={e => setSelectedVendorId(e.target.value)}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-brand-maroon"
              >
                {vendors.map(v => (
                  <option key={v.id} value={v.id}>{v.name} ({v.category})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Payment Terms</label>
              <select
                value={paymentTerms}
                onChange={e => setPaymentTerms(e.target.value)}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold outline-none"
              >
                <option>Immediate / COD</option>
                <option>Net 15 Days</option>
                <option>Net 30 Days</option>
                <option>50% Advance</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">Expected Delivery</label>
              <input
                type="date"
                value={expectedDeliveryDate}
                onChange={e => setExpectedDeliveryDate(e.target.value)}
                className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-brand-maroon"
              />
            </div>
          </div>

          {/* Line Items Table */}
          <div className="space-y-3">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <span className="text-xs font-black uppercase text-slate-700 tracking-wider">Purchase Order Items</span>
              <button
                type="button"
                onClick={addItemRow}
                className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add Item
              </button>
            </div>

            {items.map((item) => (
              <div key={item.id} className="grid grid-cols-12 gap-2 items-center bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="col-span-5">
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Item Description *</label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. 50mm Industrial Valve"
                    value={item.name}
                    onChange={e => updateItem(item.id, 'name', e.target.value)}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-bold outline-none"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Qty *</label>
                  <input
                    required
                    type="number"
                    min="1"
                    value={item.qty}
                    onChange={e => updateItem(item.id, 'qty', parseInt(e.target.value) || 1)}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-black text-center outline-none"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Unit</label>
                  <input
                    type="text"
                    value={item.unit}
                    onChange={e => updateItem(item.id, 'unit', e.target.value)}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-center outline-none"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Rate (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.rate}
                    onChange={e => updateItem(item.id, 'rate', parseFloat(e.target.value) || 0)}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-right outline-none"
                  />
                </div>

                <div className="col-span-1 flex justify-center pt-3">
                  <button
                    type="button"
                    onClick={() => removeItemRow(item.id)}
                    disabled={items.length === 1}
                    className="text-slate-400 hover:text-red-500 disabled:opacity-30 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Totals Summary */}
          <div className="flex justify-end pt-2">
            <div className="w-64 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs space-y-2">
              <div className="flex justify-between text-slate-600 font-bold">
                <span>Subtotal:</span>
                <span>₹{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-slate-600 font-bold">
                <span>GST / Tax Rate:</span>
                <div className="flex items-center gap-1 w-20">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={taxRate}
                    onChange={e => setTaxRate(parseFloat(e.target.value) || 0)}
                    className="w-full p-1 bg-white border border-slate-300 rounded text-center text-xs font-bold outline-none"
                  />
                  <span>%</span>
                </div>
              </div>
              <div className="flex justify-between items-center border-t border-slate-200 pt-2 text-sm font-black text-brand-maroon">
                <span>Total Committed:</span>
                <span>₹{grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 bg-slate-900 hover:bg-black text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-lg transition disabled:opacity-50"
          >
            {submitting ? 'Generating Purchase Order...' : 'Issue & Print Direct Purchase Order'}
          </button>
        </form>
      </div>
    </div>
  );
}