import { useState, useEffect } from 'react';
import { supabase, type InventoryItem } from '../lib/supabase';
import { ShoppingBag, Send, PlusCircle, Trash2 } from 'lucide-react';

export default function NewRequisition() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Form State
  const [location, setLocation] = useState('');
  const [urgency, setUrgency] = useState('Normal');
  const [reason, setReason] = useState('');
  
  // Catalog & Cart State
  const [catalog, setCatalog] = useState<InventoryItem[]>([]);
  const [cart, setCart] = useState<{ [key: string]: { item: InventoryItem, qty: number } }>({});
  
  // Custom Item State
  const [customItems, setCustomItems] = useState<{ name: string, category: string, qty: number }[]>([]);
  const [customName, setCustomName] = useState('');
  const [customQty, setCustomQty] = useState(1);

  useEffect(() => {
    fetchCatalog();
  }, []);

  const fetchCatalog = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('inventory_items')
      .select('*')
      .order('name');
      
    if (data && !error) {
      setCatalog(data);
    }
    setLoading(false);
  };

  const updateCart = (item: InventoryItem, qty: number) => {
    setCart(prev => {
      const newCart = { ...prev };
      if (qty <= 0) {
        delete newCart[item.id];
      } else {
        newCart[item.id] = { item, qty };
      }
      return newCart;
    });
  };

  const addCustomItem = () => {
    if (!customName.trim()) return;
    setCustomItems([...customItems, { name: customName, category: 'General / Miscellaneous', qty: customQty }]);
    setCustomName('');
    setCustomQty(1);
  };

  const removeCustomItem = (index: number) => {
    setCustomItems(customItems.filter((_, i) => i !== index));
  };

  const submitRequisition = async () => {
    const cartItems = Object.values(cart);
    if (cartItems.length === 0 && customItems.length === 0) {
      alert("Please select at least one item.");
      return;
    }
    if (!location) {
      alert("Delivery Location is required.");
      return;
    }

    setSubmitting(true);

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not authenticated");

      // 1. Insert Work Order
      // 1. Insert Work Order (Let Postgres generate the batch_id)
      const { data: orderData, error: orderError } = await supabase
        .from('work_orders')
        .insert({
          requester_id: userData.user.id,
          department: 'Maintenance', 
          location,
          urgency,
          reason,
          approval_status: 'Pending Approval',
          dispatch_status: 'Pending'
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // 2. Insert Catalog Items
      const orderItems = cartItems.map(c => ({
        work_order_id: orderData.id,
        inventory_id: c.item.id,
        requested_qty: c.qty,
        item_type: 'Catalog'
      }));

      // 3. Insert Custom Items
      const customOrderItems = customItems.map(c => ({
        work_order_id: orderData.id,
        custom_item_name: c.name,
        requested_qty: c.qty,
        item_type: 'Custom'
      }));

      const allItemsToInsert = [...orderItems, ...customOrderItems];

      if (allItemsToInsert.length > 0) {
        const { error: itemsError } = await supabase
          .from('work_order_items')
          .insert(allItemsToInsert);
          
        if (itemsError) throw itemsError;
      }

      alert(`Requisition Submitted Successfully!\nBatch Reference: ${orderData.id}`);
      
      // Reset Form
      setCart({});
      setCustomItems([]);
      setLocation('');
      setReason('');
      
    } catch (err: any) {
      alert("Error submitting requisition: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const totalSelected = Object.keys(cart).length + customItems.length;

  return (
    <div className="space-y-6 pb-24">
      {/* Section 1: Details */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 space-y-4">
        <div className="flex items-center space-x-2 border-b pb-3">
          <span className="px-2.5 py-1 bg-brand-maroon text-white text-xs font-black rounded-lg">1</span>
          <h2 className="font-extrabold text-sm uppercase text-slate-800">Location & Details</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Delivery Location *</label>
            <select 
              value={location} 
              onChange={(e) => setLocation(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold focus:ring-2 focus:ring-brand-maroon outline-none"
            >
              <option value="" disabled>-- Select Location --</option>
              <option value="Main Campus Building">Main Campus Building</option>
              <option value="Block A - Classrooms">Block A - Classrooms</option>
              <option value="Main Kitchen">Main Kitchen</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Urgency</label>
            <select 
              value={urgency} 
              onChange={(e) => setUrgency(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold focus:ring-2 focus:ring-brand-maroon outline-none"
            >
              <option value="Normal">Normal</option>
              <option value="High">High</option>
              <option value="EMERGENCY (Immediate)">EMERGENCY (Immediate)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Reason</label>
            <input 
              type="text" 
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Scheduled Repairs" 
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-brand-maroon outline-none"
            />
          </div>
        </div>
      </div>

      {/* Section 2: Live Catalog Grid */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 space-y-4">
        <div className="flex items-center space-x-2 border-b pb-3">
          <span className="px-2.5 py-1 bg-brand-maroon text-white text-xs font-black rounded-lg">2</span>
          <h2 className="font-extrabold text-sm uppercase text-slate-800">Select Materials</h2>
        </div>
        
        {loading ? (
          <div className="text-center py-8 text-slate-500 text-xs font-bold animate-pulse">Loading Catalog...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {catalog.map(item => {
              const available = Math.max(0, item.physical_stock - item.freezed_stock);
              const isOutOfStock = available <= 0;
              const currentQty = cart[item.id]?.qty || 0;

              return (
                <div key={item.id} className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[10px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200 uppercase">{item.unit}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${isOutOfStock ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {isOutOfStock ? 'Out of Stock' : `Avail: ${available}`}
                      </span>
                    </div>
                    <h3 className="font-extrabold text-sm text-slate-800">{item.name}</h3>
                    <p className="text-[11px] text-slate-500">{item.category}</p>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3">
                    <span className="text-xs font-bold text-slate-600">Qty:</span>
                    <input 
                      type="number" 
                      min="0" 
                      max={available}
                      disabled={isOutOfStock}
                      value={currentQty}
                      onChange={(e) => updateCart(item, parseInt(e.target.value) || 0)}
                      className="w-16 px-2 py-1 border border-slate-300 rounded text-xs font-bold text-center disabled:opacity-50"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Section 3: Custom Items */}
      <div className="bg-amber-50/50 rounded-2xl p-5 border border-amber-200 space-y-3">
        <h3 className="text-xs font-extrabold text-amber-900 uppercase">Add Unlisted / Custom Item</h3>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
          <input 
            type="text" 
            placeholder="Describe custom item..." 
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            className="md:col-span-8 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium outline-none"
          />
          <input 
            type="number" 
            min="1" 
            value={customQty}
            onChange={(e) => setCustomQty(parseInt(e.target.value) || 1)}
            className="md:col-span-2 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-center outline-none"
          />
          <button 
            onClick={addCustomItem}
            className="md:col-span-2 flex items-center justify-center space-x-1 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-lg py-2 transition"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Add</span>
          </button>
        </div>

        {customItems.length > 0 && (
          <div className="mt-4 space-y-2">
            {customItems.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-200 text-xs">
                <span className="font-bold text-slate-800">{item.name} <span className="text-slate-500 font-normal">(Custom)</span></span>
                <div className="flex items-center space-x-4">
                  <span className="font-extrabold">Qty: {item.qty}</span>
                  <button onClick={() => removeCustomItem(idx)} className="text-red-500 hover:text-red-700">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sticky Bottom Submit Bar */}
      {totalSelected > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-full max-w-xl px-4 z-50">
          <div className="bg-slate-900 text-white p-3.5 rounded-2xl shadow-2xl border border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-3 pl-2">
              <div className="p-2 bg-brand-maroon rounded-xl">
                <ShoppingBag className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-medium">Ready to Submit</p>
                <p className="text-sm font-extrabold"><span className="text-brand-gold">{totalSelected}</span> Item(s) Selected</p>
              </div>
            </div>
            <button 
              onClick={submitRequisition}
              disabled={submitting}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow transition flex items-center space-x-2 disabled:opacity-70"
            >
              <span>{submitting ? 'Processing...' : 'Submit Batch'}</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}