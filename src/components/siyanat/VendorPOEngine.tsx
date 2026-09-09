import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { ShoppingCart, X, FileText, PackagePlus, Building2, Calendar, CreditCard, IndianRupee } from 'lucide-react';
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
  const [unitPrices, setUnitPrices] = useState<Record<string, number>>({});

  // Global order-level terms
  const [paymentTerms, setPaymentTerms] = useState<string>('Immediate / COD');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState<string>(
    new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [taxRate, setTaxRate] = useState<number>(18.0);

  // Accept any non-fulfilled items
  const pendingItems = (batch.items || []).filter(i =>
    !['Stock Injected', 'Fulfilled & Received', 'Cancelled'].includes(i.status)
  );

  useEffect(() => {
    const fetchVendorsAndInitialPrices = async () => {
      const { data: vendorData, error: vendorErr } = await supabase
        .from('vendors')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (vendorErr) {
        console.error("Error loading vendors:", vendorErr);
        return;
      }

      if (vendorData && vendorData.length > 0) {
        setVendors(vendorData as Vendor[]);
        const defaultVendorId = vendorData[0]?.id || '';
        const initialVendors: Record<string, string> = {};
        const initialQtys: Record<string, number> = {};
        const initialPrices: Record<string, number> = {};

        // Fetch pre-existing price agreements for the default vendor
        const { data: agreements } = await supabase
          .from('vendor_price_agreements')
          .select('item_name, unit_price, tax_rate')
          .eq('vendor_id', defaultVendorId);

        const agreementMap = new Map(
          (agreements || []).map(a => [a.item_name.trim().toLowerCase(), a])
        );

        pendingItems.forEach(item => {
          const itemName = (item.inventory?.name || item.custom_item_name || '').trim().toLowerCase();
          const matchedAgreement = agreementMap.get(itemName);

          initialVendors[item.id] = defaultVendorId;
          initialQtys[item.id] = item.requested_qty || 1;
          initialPrices[item.id] = matchedAgreement ? Number(matchedAgreement.unit_price) : 0;
        });

        setItemVendors(initialVendors);
        setOrderQuantities(initialQtys);
        setUnitPrices(initialPrices);
      }
    };

    fetchVendorsAndInitialPrices();
  }, [batch.id]);

  // Handle vendor change per item with instant catalog lookup
  const handleVendorChange = async (itemId: string, selectedVendorId: string, itemRawName: string = '') => {
    setItemVendors(prev => ({ ...prev, [itemId]: selectedVendorId }));

    if (!selectedVendorId || !itemRawName) return;

    try {
      const cleanName = itemRawName.trim();
      const { data } = await supabase
        .from('vendor_price_agreements')
        .select('unit_price, tax_rate')
        .eq('vendor_id', selectedVendorId)
        .ilike('item_name', cleanName)
        .limit(1)
        .maybeSingle();

      if (data && Number(data.unit_price) > 0) {
        setUnitPrices(prev => ({ ...prev, [itemId]: Number(data.unit_price) }));
        if (data.tax_rate) setTaxRate(Number(data.tax_rate));
        showToast(`Agreed rate ₹${data.unit_price} applied for ${cleanName}`, 'success');
      }
    } catch (err) {
      console.warn("Price agreement lookup skipped:", err);
    }
  };

  // Real-time calculation of totals
  const estimatedSubtotal = pendingItems.reduce((sum, item) => {
    const qty = orderQuantities[item.id] ?? item.requested_qty ?? 1;
    const rate = unitPrices[item.id] ?? 0;
    return sum + (qty * rate);
  }, 0);
  const estimatedTax = (estimatedSubtotal * taxRate) / 100;
  const estimatedGrandTotal = estimatedSubtotal + estimatedTax;

  const generatePOs = async (e: React.FormEvent) => {
    e.preventDefault();

    if (pendingItems.length === 0) {
      showToast('No pending items found on this batch to order.', 'warning');
      return;
    }

    // Guard against 0 or empty rates
    const zeroRateItem = pendingItems.find(i => !unitPrices[i.id] || Number(unitPrices[i.id]) <= 0);
    if (zeroRateItem) {
      showToast(`Please enter an agreed unit rate (₹) for "${zeroRateItem.inventory?.name || zeroRateItem.custom_item_name}"`, 'warning');
      return;
    }

    // Check for unassigned vendor
    const unassignedItem = pendingItems.find(i => !itemVendors[i.id]);
    if (unassignedItem) {
      showToast(`Please select a vendor for "${unassignedItem.inventory?.name || unassignedItem.custom_item_name}"`, 'warning');
      return;
    }

    setIsProcessing(true);

    try {
      // Group items by vendor
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
          item_type: item.item_type || 'custom',
          inventory_id: item.inventory_id || null,
          custom_item_name: item.custom_item_name || item.inventory?.name || 'Item',
          requested_qty: Number(orderQuantities[item.id]) || Number(item.requested_qty) || 1,
          unit_price: Number(unitPrices[item.id]) || 0,
          line_total: (Number(orderQuantities[item.id]) || Number(item.requested_qty) || 1) * (Number(unitPrices[item.id]) || 0)
        }));

        const rpcPayload = {
          p_batch_id: batch.id,
          p_vendor_id: vendorId,
          p_technician_id: batch.requester?.id || null,
          p_reason: batch.reason || '',
          p_items: itemsPayload,
          p_user_email: userEmail,
          p_payment_terms: paymentTerms || 'Immediate / COD',
          p_expected_delivery_date: expectedDeliveryDate || null,
          p_tax_rate: Number(taxRate) || 0
        };

        const { data: poNumber, error } = await supabase.rpc('generate_vendor_po', rpcPayload);

        if (error) throw error;
        if (poNumber) generatedPoNumbers.push(poNumber);
      }

      showToast(`Successfully created ${generatedPoNumbers.length} PO(s): ${generatedPoNumbers.join(', ')}`, 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("PO Creation Failed:", err);
      showToast('Error generating PO: ' + (err.message || 'Unknown database error'), 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        <div className="bg-indigo-600 p-5 flex justify-between items-center text-white shrink-0">
          <h3 className="font-extrabold text-sm uppercase flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" /> Commercial Purchase Order Generator
          </h3>
          <button type="button" onClick={onClose} className="hover:bg-white/20 p-1 rounded-lg transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form noValidate onSubmit={generatePOs} className="p-6 space-y-5 overflow-y-auto flex-1">
          <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100 flex items-start gap-3">
            <PackagePlus className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-black text-indigo-900 mb-0.5 uppercase tracking-wide">Multi-Vendor Commercial Routing</p>
              <p className="text-[11px] font-bold text-indigo-700/80">
                Suppliers with uploaded price directories will automatically populate rates upon selection.
              </p>
            </div>
          </div>

          {/* Order-Level Commercial Terms */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <div>
              <label className="text-[10px] font-black uppercase text-slate-500 block mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" /> Expected Delivery (SLA) *
              </label>
              <input
                type="date"
                value={expectedDeliveryDate}
                onChange={e => setExpectedDeliveryDate(e.target.value)}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="text-[10px] font-black uppercase text-slate-500 block mb-1 flex items-center gap-1">
                <CreditCard className="w-3.5 h-3.5 text-slate-400" /> Payment Terms *
              </label>
              <select
                value={paymentTerms}
                onChange={e => setPaymentTerms(e.target.value)}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="Immediate / COD">Cash on Delivery (Immediate)</option>
                <option value="Net 15 Days">Net 15 Days</option>
                <option value="Net 30 Days">Net 30 Days</option>
                <option value="100% Advance">100% Advance Payment</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase text-slate-500 block mb-1 flex items-center gap-1">
                <IndianRupee className="w-3.5 h-3.5 text-slate-400" /> Applicable Tax (GST %)
              </label>
              <select
                value={taxRate}
                onChange={e => setTaxRate(parseFloat(e.target.value))}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value={0}>0% (Tax Exempt / Nil)</option>
                <option value={5}>5% GST</option>
                <option value={12}>12% GST</option>
                <option value={18}>18% Standard GST</option>
                <option value={28}>28% GST</option>
              </select>
            </div>
          </div>

          {/* Item Row Breakdown */}
          <div className="space-y-3">
            {pendingItems.map((item, index) => {
              const currentQty = orderQuantities[item.id] ?? item.requested_qty ?? 1;
              const currentRate = unitPrices[item.id] ?? 0;
              const lineTotal = currentQty * currentRate;
              const displayName = item.inventory?.name || item.custom_item_name || 'Item';

              return (
                <div key={item.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="flex-1 min-w-[200px]">
                    <span className="text-[9px] font-black uppercase text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 mb-1 inline-block">Item {index + 1}</span>
                    <p className="text-xs font-bold text-slate-800">{displayName}</p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">
                      Requested: <span className="text-brand-maroon font-black">{item.requested_qty}</span>
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    {/* Vendor Select with instant Price Directory matching */}
                    <div className="flex-1 md:w-48">
                      <label className="block text-[9px] font-black text-slate-500 uppercase mb-1 flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-slate-400" /> Vendor
                      </label>
                      <select
                        value={itemVendors[item.id] ?? ''}
                        onChange={e => handleVendorChange(item.id, e.target.value, displayName)}
                        className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="" disabled>-- Select Vendor --</option>
                        {vendors.map(v => (
                          <option key={v.id} value={v.id}>{v.name} ({v.category})</option>
                        ))}
                      </select>
                    </div>

                    {/* Order Qty */}
                    <div className="w-20">
                      <label className="block text-[9px] font-black text-slate-500 uppercase mb-1">Qty</label>
                      <input
                        type="number"
                        min={1}
                        value={currentQty}
                        onChange={e => setOrderQuantities({ ...orderQuantities, [item.id]: parseInt(e.target.value) || 1 })}
                        className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-black text-center outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    {/* Auto-populated / Editable Unit Price */}
                    <div className="w-24">
                      <label className="block text-[9px] font-black text-slate-500 uppercase mb-1">Rate (₹)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={unitPrices[item.id] !== undefined && unitPrices[item.id] !== 0 ? unitPrices[item.id] : ''}
                        onChange={e => setUnitPrices({ ...unitPrices, [item.id]: parseFloat(e.target.value) || 0 })}
                        className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-black text-right outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    {/* Line Total */}
                    <div className="w-24 text-right pt-2">
                      <span className="text-[9px] text-slate-400 font-bold uppercase block">Line Total</span>
                      <span className="text-xs font-black text-brand-maroon">
                        ₹{lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Financial Summary Card */}
          <div className="bg-slate-900 text-white p-4 rounded-2xl flex justify-between items-center text-xs">
            <div>
              <span className="text-[10px] uppercase font-black tracking-widest text-slate-400 block">Total Est. Commitment</span>
              <span className="text-[11px] text-slate-300 font-bold">
                Subtotal: ₹{estimatedSubtotal.toFixed(2)} + GST ({taxRate}%): ₹{estimatedTax.toFixed(2)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-lg font-black text-brand-gold">
                ₹{estimatedGrandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <button
            type="submit"
            disabled={isProcessing}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-lg transition disabled:opacity-50 flex justify-center items-center gap-2 cursor-pointer"
          >
            <FileText className="w-4 h-4" /> {isProcessing ? 'Generating Orders...' : 'Generate Split Purchase Orders'}
          </button>
        </form>
      </div>
    </div>
  );
}