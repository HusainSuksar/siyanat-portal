import { useState, useEffect } from 'react';
import { supabase, type InventoryItem } from '../lib/supabase';
import { ShoppingBag, Send, PlusCircle, Trash2, CheckCircle, PackageSearch } from 'lucide-react';

const ZONES = [
  "Main Jamea Complex",
  "Rabwat (Girls Hostel)",
  "Masakin (Boys Hostel)",
  "Mawaid",
  "Khaimat al-Riyadat"
];

export default function NewRequisition() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [userRole, setUserRole] = useState('REQUESTER');
  const [isSupervisor, setIsSupervisor] = useState(false);
  const [successBatch, setSuccessBatch] = useState<string | null>(null);
  
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
    let role = 'REQUESTER';
    let assignedZone = '';
    
    // 1. Get user role and zone for RBAC
    const { data: authData } = await supabase.auth.getUser();
    if (authData.user) {
      const { data: profile } = await supabase.from('profiles').select('role, zone').eq('id', authData.user.id).single();
      if (profile) {
        role = profile.role;
        assignedZone = profile.zone;
        setUserRole(role);
        
        if (role === 'SUPERVISOR') {
          setIsSupervisor(true);
          if (assignedZone) setLocation(assignedZone);
        }
      }
    }

    // 2. Fetch Catalog with strict Requester filtering
    let query = supabase.from('inventory_items').select('*').order('name');
    
    // Updated to check for REQUESTER instead of STANDARD_USER
    if (role === 'REQUESTER') {
      // Requesters only see Stationery and AVIT
      query = query.in('category', ['Office & Administrative Supplies', 'IT & Networking Hardware']);
    }

    const { data, error } = await query;
      
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
      alert("Delivery Location (Zone) is required.");
      return;
    }

    setSubmitting(true);

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not authenticated");

      // 1. Insert Work Order
      // THE FIX: Removed approval_status & dispatch_status. DB handles pipeline_state.
      const { data: orderData, error: orderError } = await supabase
        .from('work_orders')
        .insert({
          requester_id: userData.user.id,
          department: userRole === 'REQUESTER' ? 'General Staff' : 'Maintenance', 
          location,
          urgency,
          reason
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // 2. Insert Catalog Items
      const orderItems = cartItems.map(c => ({
        work_order_id: orderData.id,
        inventory_id: c.item.id,
        requested_qty: c.qty,
        item_type: 'Catalog',
        fulfillment_dept: c.item.fulfillment_dept // Pass the DB tag up to the order
      }));

      // 3. Insert Custom Items
      const customOrderItems = customItems.map(c => ({
        work_order_id: orderData.id,
        custom_item_name: c.name,
        requested_qty: c.qty,
        item_type: 'Custom'
        // Custom items fallback to the DB default (SIYANAT_HEAD)
      }));

      const allItemsToInsert = [...orderItems, ...customOrderItems];

      if (allItemsToInsert.length > 0) {
        const { error: itemsError } = await supabase
          .from('work_order_items')
          .insert(allItemsToInsert);
          
        if (itemsError) throw itemsError;
      }
      
      // Log to Audit Trail
      await supabase.from('system_logs').insert({
        action_type: 'REQUISITION_SUBMITTED',
        description: `Submitted material requisition ${orderData.batch_id || orderData.id} for ${location}.`,
        user_email: userData.user.email || 'Requester'
      });

      setSuccessBatch(orderData.batch_id || orderData.id);
      
      // Reset Form
      setCart({});
      setCustomItems([]);
      if (!isSupervisor) setLocation('');
      setReason('');
      
    } catch (err: any) {
      alert("Error submitting requisition: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const totalSelected = Object.keys(cart).length + customItems.length;
  const isStandardUser = userRole === 'REQUESTER';

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-24">
      <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
        <div className="p-4 bg-brand-maroon text-brand-gold rounded-2xl shadow-md shrink-0">
          <PackageSearch className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight">Material Requisition</h2>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">
            {isStandardUser ? 'Request Stationery and AVIT supplies.' : 'Request materials, tools, and maintenance supplies.'}
          </p>
        </div>
      </div>

      {/* Section 1: Details */}
      <div className="bg-white rounded-3xl p-5 md:p-8 shadow-sm border border-slate-200">
        <div className="flex items-center space-x-2 border-b border-slate-100 pb-4 mb-6">
          <span className="flex items-center justify-center w-6 h-6 bg-brand-maroon text-white text-xs font-black rounded-lg">1</span>
          <h3 className="font-black text-sm uppercase tracking-wide text-slate-800">Delivery Details</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6">
          <div>
            <label className="block text-[11px] font-black text-slate-500 uppercase mb-2">Delivery Zone *</label>
            <select 
              required
              disabled={isSupervisor}
              value={location} 
              onChange={(e) => setLocation(e.target.value)}
              className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-brand-maroon outline-none transition shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
            >
              <option value="" disabled>-- Select Zone --</option>
              {ZONES.map(z => <option key={z} value={z}>{z}</option>)}
            </select>
            {isSupervisor && <p className="text-[9px] font-bold text-brand-maroon mt-1.5 uppercase">Locked to assigned zone</p>}
          </div>
          <div>
            <label className="block text-[11px] font-black text-slate-500 uppercase mb-2">Urgency</label>
            <select 
              value={urgency} 
              onChange={(e) => setUrgency(e.target.value)}
              className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-brand-maroon outline-none transition shadow-sm"
            >
              <option value="Normal">Normal</option>
              <option value="High">High</option>
              <option value="EMERGENCY (Immediate)">EMERGENCY (Immediate)</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-black text-slate-500 uppercase mb-2">Reason</label>
            <input 
              type="text" 
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Scheduled Repairs" 
              className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-brand-maroon outline-none transition shadow-sm"
            />
          </div>
        </div>
      </div>

      {/* Section 2: Live Catalog Grid */}
      <div className="bg-white rounded-3xl p-5 md:p-8 shadow-sm border border-slate-200">
        <div className="flex items-center space-x-2 border-b border-slate-100 pb-4 mb-6">
          <span className="flex items-center justify-center w-6 h-6 bg-brand-maroon text-white text-xs font-black rounded-lg">2</span>
          <h3 className="font-black text-sm uppercase tracking-wide text-slate-800">Select Materials</h3>
        </div>
        
        {loading ? (
          <div className="text-center py-12 text-slate-500 text-sm font-bold animate-pulse bg-slate-50 rounded-2xl border border-slate-100">Loading Warehouse Catalog...</div>
        ) : catalog.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm font-bold bg-slate-50 rounded-2xl border border-slate-100">No items available in your approved catalog.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {catalog.map(item => {
              const available = Math.max(0, item.physical_stock - item.freezed_stock);
              const isOutOfStock = available <= 0;
              const currentQty = cart[item.id]?.qty || 0;
              const canSeeStock = userRole === 'SUPER_ADMIN' || userRole === 'SUPERVISOR' || userRole === 'SIYANAT_HEAD' || userRole === 'TANZEEM_HEAD' || userRole === 'AVIT_HEAD';

              return (
                <div key={item.id} className={`rounded-2xl p-4 border flex flex-col justify-between transition-all ${currentQty > 0 ? 'border-brand-maroon bg-brand-maroon/5 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-[10px] font-black text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 uppercase tracking-widest">{item.unit}</span>
                      
                      {canSeeStock ? (
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider shadow-sm ${isOutOfStock ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-emerald-100 text-emerald-800 border border-emerald-200'}`}>
                          {isOutOfStock ? 'Out of Stock' : `Avail: ${available}`}
                        </span>
                      ) : (
                        <span className="text-[9px] font-black px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 border border-indigo-200 uppercase tracking-wider">
                          Catalog
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-sm text-slate-800 leading-tight">{item.name}</h3>
                    <p className="text-[10px] text-slate-500 font-bold mt-1 uppercase tracking-wide line-clamp-1">{item.category}</p>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                    <span className="text-xs font-black text-slate-400 uppercase tracking-wider">Qty</span>
                    <input 
                      type="number" 
                      min="0" 
                      max={canSeeStock ? available : undefined} 
                      disabled={canSeeStock && isOutOfStock}
                      value={currentQty === 0 ? '' : currentQty}
                      placeholder="0"
                      onChange={(e) => updateCart(item, parseInt(e.target.value) || 0)}
                      className="w-16 px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-sm font-black text-center disabled:opacity-50 focus:ring-2 focus:ring-brand-maroon outline-none transition"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Section 3: Custom Items */}
      <div className="bg-amber-50/50 rounded-3xl p-5 md:p-8 border border-amber-200">
        <h3 className="text-xs font-black text-amber-900 uppercase tracking-wider mb-4">Request Unlisted / Custom Item</h3>
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <input 
            type="text" 
            placeholder="Describe custom item clearly..." 
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            className="sm:col-span-7 md:col-span-8 px-4 py-3 bg-white border border-slate-300 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-maroon transition shadow-sm"
          />
          <input 
            type="number" 
            min="1" 
            value={customQty}
            onChange={(e) => setCustomQty(parseInt(e.target.value) || 1)}
            className="sm:col-span-2 px-4 py-3 bg-white border border-slate-300 rounded-xl text-sm font-black text-center outline-none focus:ring-2 focus:ring-brand-maroon transition shadow-sm"
          />
          <button 
            type="button"
            onClick={addCustomItem}
            className="sm:col-span-3 md:col-span-2 flex items-center justify-center space-x-1.5 bg-slate-800 hover:bg-slate-900 text-white font-black text-xs uppercase tracking-wide rounded-xl py-3 transition shadow-sm"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Add</span>
          </button>
        </div>

        {customItems.length > 0 && (
          <div className="mt-5 space-y-2 animate-in fade-in">
            {customItems.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-200 text-sm shadow-sm">
                <div>
                  <span className="font-bold text-slate-800">{item.name}</span>
                  <span className="text-[10px] font-black text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded ml-2 uppercase tracking-wide">Custom</span>
                </div>
                <div className="flex items-center space-x-4">
                  <span className="font-black text-slate-700 bg-slate-100 px-2 py-1 rounded">Qty: {item.qty}</span>
                  <button onClick={() => removeCustomItem(idx)} className="text-slate-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-lg transition"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sticky Bottom Submit Bar */}
      {totalSelected > 0 && (
        <div className="fixed bottom-4 md:bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-xl z-50 animate-in slide-in-from-bottom-8 duration-300">
          <div className="bg-slate-900 text-white p-3 md:p-4 rounded-2xl shadow-2xl border border-slate-800 flex items-center justify-between backdrop-blur-xl bg-opacity-95">
            <div className="flex items-center space-x-3 pl-2">
              <div className="p-2 md:p-2.5 bg-brand-maroon rounded-xl shadow-inner">
                <ShoppingBag className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-[10px] md:text-xs text-slate-400 font-bold uppercase tracking-wider">Ready to Submit</p>
                <p className="text-sm md:text-base font-black"><span className="text-brand-gold">{totalSelected}</span> Item(s) Selected</p>
              </div>
            </div>
            <button 
              onClick={submitRequisition}
              disabled={submitting}
              className="px-5 py-3 md:py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-lg transition flex items-center space-x-2 disabled:opacity-70"
            >
              <span>{submitting ? 'Processing...' : 'Submit Batch'}</span>
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* CREATIVE SUCCESS MODAL */}
      {successBatch && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center max-w-sm w-full animate-in zoom-in-95 duration-300">
            <div className="w-20 h-20 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mb-5 shadow-inner">
              <CheckCircle className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-black text-slate-800 text-center mb-2">Submitted!</h3>
            <p className="text-sm text-slate-500 text-center font-medium">
              Your material requisition has been routed for approval.
            </p>
            <div className="mt-5 w-full bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col items-center">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Batch Reference</span>
              <span className="text-lg font-black text-brand-maroon tracking-wider">{successBatch}</span>
            </div>
            <button 
              onClick={() => setSuccessBatch(null)} 
              className="mt-6 w-full py-3.5 bg-slate-900 text-white font-black uppercase tracking-wide text-xs rounded-xl hover:bg-black transition shadow-lg"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}