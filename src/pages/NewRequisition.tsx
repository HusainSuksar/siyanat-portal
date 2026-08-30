import { useState, useEffect, useMemo } from 'react';
import { supabase, type InventoryItem } from '../lib/supabase';
import { ShoppingBag, Send, PlusCircle, Trash2, CheckCircle, PackageSearch, Search, Filter } from 'lucide-react';
import { ZONE_FLOW_MAP, MASTER_ZONES } from '../constants/locations'; 

export default function NewRequisition() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [userRole, setUserRole] = useState('REQUESTER');
  const [isSupervisor, setIsSupervisor] = useState(false);
  const [successBatch, setSuccessBatch] = useState<string | null>(null);
  
  // Dynamic Location State
  const [selectedZone, setSelectedZone] = useState('');
  const [selectedVenue, setSelectedVenue] = useState('');
  const [selectedFloor, setSelectedFloor] = useState('');
  const [selectedRoom, setSelectedRoom] = useState('');

  const [urgency, setUrgency] = useState('Normal');
  const [reason, setReason] = useState('');
  
  const [catalog, setCatalog] = useState<InventoryItem[]>([]);
  const [cart, setCart] = useState<{ [key: string]: { item: InventoryItem, qty: number } }>({});
  
  // Search & Department Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('ALL');

  // Custom Item State
  const [customItems, setCustomItems] = useState<{ name: string, category: string, qty: number, fulfillment_dept: string }[]>([]);
  const [customName, setCustomName] = useState('');
  const [customQty, setCustomQty] = useState(1);
  const [customDept, setCustomDept] = useState('SIYANAT_HEAD'); // NEW: Department Routing State

  useEffect(() => {
    fetchCatalog();
  }, []);

  const fetchCatalog = async () => {
    setLoading(true);
    let role = 'REQUESTER';
    
    const { data: authData } = await supabase.auth.getUser();
    if (authData.user) {
      const { data: profile } = await supabase.from('profiles').select('role, zone').eq('id', authData.user.id).single();
      if (profile) {
        role = profile.role;
        setUserRole(role);
        
        if (role === 'SUPERVISOR') {
          setIsSupervisor(true);
          if (profile.zone) setSelectedZone(profile.zone.split(',')[0].trim());
        }
      }
    }

    const { data, error } = await supabase.from('inventory_items').select('*').order('name');
    if (data && !error) setCatalog(data);
    setLoading(false);
  };

  const filteredCatalog = useMemo(() => {
    return catalog.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (item.category && item.category.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesDept = selectedDeptFilter === 'ALL' || item.fulfillment_dept === selectedDeptFilter;
      return matchesSearch && matchesDept;
    });
  }, [catalog, searchQuery, selectedDeptFilter]);

  const activeVenues = selectedZone ? ZONE_FLOW_MAP[selectedZone] : [];
  const activeVenueObj = activeVenues?.find(v => v.name === selectedVenue);
  const subConfig = activeVenueObj?.subConfig;
  
  const availableRoomsForFloor = (subConfig?.type === 'SELECT_FLOOR_ROOM' && selectedFloor)
    ? subConfig.floors?.[selectedFloor] || []
    : [];

  const requiresRoomDropdown = (subConfig?.type === 'SELECT_ROOM' || subConfig?.type === 'SELECT_BATHROOM') || 
                               (subConfig?.type === 'SELECT_FLOOR_ROOM' && availableRoomsForFloor.length > 0);

  const handleZoneChange = (zone: string) => {
    setSelectedZone(zone);
    setSelectedVenue(''); setSelectedFloor(''); setSelectedRoom('');
  };
  const handleVenueChange = (venue: string) => {
    setSelectedVenue(venue);
    setSelectedFloor(''); setSelectedRoom('');
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
    setCustomItems([...customItems, { 
      name: customName, 
      category: 'General / Miscellaneous', 
      qty: customQty, 
      fulfillment_dept: customDept // Save the selected routing
    }]);
    setCustomName('');
    setCustomQty(1);
    // Keep customDept as is for quick multi-adds
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
    if (!selectedZone || !selectedVenue) {
      alert("Delivery Zone and Venue are required.");
      return;
    }

    setSubmitting(true);

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not authenticated");

      const fullLocation = [selectedZone, selectedVenue, selectedFloor, selectedRoom].filter(Boolean).join(' - ');

      const { data: orderData, error: orderError } = await supabase
        .from('work_orders')
        .insert({
          requester_id: userData.user.id,
          department: userRole === 'REQUESTER' ? 'General Staff' : 'Maintenance', 
          location: fullLocation,
          urgency,
          reason
        })
        .select()
        .single();

      if (orderError) throw orderError;

      const orderItems = cartItems.map(c => ({
        work_order_id: orderData.id,
        inventory_id: c.item.id,
        requested_qty: c.qty,
        item_type: 'Catalog',
        fulfillment_dept: c.item.fulfillment_dept || 'SIYANAT_HEAD' 
      }));

      // Map dynamic department for custom items
      const customOrderItems = customItems.map(c => ({
        work_order_id: orderData.id,
        custom_item_name: c.name,
        requested_qty: c.qty,
        item_type: 'Custom',
        fulfillment_dept: c.fulfillment_dept 
      }));

      const allItemsToInsert = [...orderItems, ...customOrderItems];

      if (allItemsToInsert.length > 0) {
        const { error: itemsError } = await supabase.from('work_order_items').insert(allItemsToInsert);
        if (itemsError) throw itemsError;
      }
      
      await supabase.from('system_logs').insert({
        action_type: 'REQUISITION_SUBMITTED',
        description: `Submitted material requisition ${orderData.batch_id || orderData.id} for ${fullLocation}.`,
        user_email: userData.user.email || 'Requester'
      });

      setSuccessBatch(orderData.batch_id || orderData.id);
      
      // Reset Form
      setCart({});
      setCustomItems([]);
      if (!isSupervisor) setSelectedZone('');
      setSelectedVenue(''); setSelectedFloor(''); setSelectedRoom('');
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
            {isStandardUser ? 'Request Stationery, AVIT, and campus materials.' : 'Request materials, tools, and maintenance supplies.'}
          </p>
        </div>
      </div>

      {/* --- Delivery Details with Location Engine --- */}
      <div className="bg-white rounded-3xl p-5 md:p-8 shadow-sm border border-slate-200">
        <div className="flex items-center space-x-2 border-b border-slate-100 pb-4 mb-6">
          <span className="flex items-center justify-center w-6 h-6 bg-brand-maroon text-white text-xs font-black rounded-lg">1</span>
          <h3 className="font-black text-sm uppercase tracking-wide text-slate-800">Delivery Details</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6 animate-in fade-in duration-300">
          {/* TIER 1: ZONE */}
          <div>
            <label className="block text-[11px] font-black text-slate-500 uppercase mb-2">Delivery Zone *</label>
            <select required disabled={isSupervisor} value={selectedZone} onChange={e => handleZoneChange(e.target.value)} className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-brand-maroon outline-none transition shadow-sm disabled:opacity-70 disabled:cursor-not-allowed">
              <option value="" disabled>-- Select Zone --</option>
              {MASTER_ZONES.map(zone => <option key={zone} value={zone}>{zone}</option>)}
            </select>
            {isSupervisor && <p className="text-[9px] font-bold text-brand-maroon mt-1.5 uppercase">Locked to assigned zone</p>}
          </div>

          {/* TIER 2: VENUE */}
          <div>
            <label className="block text-[11px] font-black text-slate-500 uppercase mb-2">Building / Venue *</label>
            <select required disabled={!selectedZone} value={selectedVenue} onChange={e => handleVenueChange(e.target.value)} className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-brand-maroon outline-none transition shadow-sm disabled:opacity-50">
              <option value="" disabled>{selectedZone ? '-- Select Venue --' : 'Select Zone First'}</option>
              {activeVenues?.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
            </select>
          </div>

          {/* TIER 3: FLOOR */}
          {subConfig?.type === 'SELECT_FLOOR_ROOM' && (
            <div className="animate-in fade-in zoom-in-95 duration-200">
              <label className="block text-[11px] font-black text-slate-500 uppercase mb-2">Select Floor / Location *</label>
              <select required value={selectedFloor} onChange={e => { setSelectedFloor(e.target.value); setSelectedRoom(''); }} className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-brand-maroon outline-none transition shadow-sm">
                <option value="" disabled>-- Choose Floor / Location --</option>
                {Object.keys(subConfig.floors || {}).map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          )}

          {/* TIER 4: ROOM */}
          {requiresRoomDropdown && (
            <div className="animate-in fade-in zoom-in-95 duration-200">
              <label className="block text-[11px] font-black text-slate-500 uppercase mb-2">
                {subConfig?.type === 'SELECT_BATHROOM' ? 'Bathroom No *' : 'Room / Class No *'}
              </label>
              <select required value={selectedRoom} onChange={e => setSelectedRoom(e.target.value)} className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-brand-maroon outline-none transition shadow-sm">
                <option value="" disabled>-- Select Option --</option>
                {(subConfig?.type === 'SELECT_FLOOR_ROOM' ? availableRoomsForFloor : subConfig?.options || []).map((opt: string) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          )}

          <div className="md:col-span-2 border-t border-slate-100 pt-5 mt-2 grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
            <div>
              <label className="block text-[11px] font-black text-slate-500 uppercase mb-2">Urgency</label>
              <select value={urgency} onChange={(e) => setUrgency(e.target.value)} className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-brand-maroon outline-none transition shadow-sm">
                <option value="Normal">Normal</option>
                <option value="High">High</option>
                <option value="EMERGENCY (Immediate)">EMERGENCY (Immediate)</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-black text-slate-500 uppercase mb-2">Reason</label>
              <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Scheduled Maintenance / Office Setup" className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-brand-maroon outline-none transition shadow-sm" />
            </div>
          </div>
        </div>
      </div>

      {/* --- Catalog Section --- */}
      <div className="bg-white rounded-3xl p-5 md:p-8 shadow-sm border border-slate-200">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center border-b border-slate-100 pb-4 mb-6 gap-3">
          <div className="flex items-center space-x-2">
            <span className="flex items-center justify-center w-6 h-6 bg-brand-maroon text-white text-xs font-black rounded-lg">2</span>
            <h3 className="font-black text-sm uppercase tracking-wide text-slate-800">Select Materials</h3>
          </div>
          <span className="text-[11px] font-bold text-slate-400 uppercase">
            Showing {filteredCatalog.length} item(s)
          </span>
        </div>

        {/* SEARCH & DEPARTMENT FILTER BAR */}
        <div className="flex flex-col md:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search items by name or category..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-brand-maroon transition shadow-sm"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
            <Filter className="w-4 h-4 text-slate-400 shrink-0 hidden sm:block" />
            {[
              { id: 'ALL', label: 'All Items' },
              { id: 'SIYANAT_HEAD', label: 'Siyanat' },
              { id: 'AVIT_HEAD', label: 'AVIT' },
              { id: 'TANZEEM_HEAD', label: 'Stationery' },
            ].map(dept => (
              <button
                key={dept.id}
                type="button"
                onClick={() => setSelectedDeptFilter(dept.id)}
                className={`px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider whitespace-nowrap transition border ${
                  selectedDeptFilter === dept.id
                    ? 'bg-brand-maroon text-white border-brand-maroon shadow-sm'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {dept.label}
              </button>
            ))}
          </div>
        </div>
        
        {loading ? (
          <div className="text-center py-12 text-slate-500 text-sm font-bold animate-pulse bg-slate-50 rounded-2xl border border-slate-100">Loading Warehouse Catalog...</div>
        ) : filteredCatalog.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm font-bold bg-slate-50 rounded-2xl border border-slate-100">
            No items found matching your filters.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredCatalog.map(item => {
              const available = Math.max(0, item.physical_stock - item.freezed_stock);
              const isOutOfStock = available <= 0;
              const currentQty = cart[item.id]?.qty || 0;
              const canSeeStock = userRole === 'SUPER_ADMIN' || userRole === 'SUPERVISOR' || userRole === 'SIYANAT_HEAD' || userRole === 'TANZEEM_HEAD' || userRole === 'AVIT_HEAD';

              return (
                <div key={item.id} className={`rounded-2xl p-4 border flex flex-col justify-between transition-all ${currentQty > 0 ? 'border-brand-maroon bg-brand-maroon/5 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-[10px] font-black text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 uppercase tracking-widest">{item.unit || 'Pcs'}</span>
                      
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

      {/* --- Custom Items Section --- */}
      <div className="bg-amber-50/50 rounded-3xl p-5 md:p-8 border border-amber-200">
        <h3 className="text-xs font-black text-amber-900 uppercase tracking-wider mb-4">Request Unlisted / Custom Item</h3>
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <input 
            type="text" 
            placeholder="Describe custom item clearly..." 
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            className="sm:col-span-5 px-4 py-3 bg-white border border-slate-300 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-maroon transition shadow-sm"
          />
          <select 
            value={customDept}
            onChange={(e) => setCustomDept(e.target.value)}
            className="sm:col-span-3 px-4 py-3 bg-white border border-slate-300 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-brand-maroon transition shadow-sm"
          >
            <option value="SIYANAT_HEAD">Route to Siyanat</option>
            <option value="TANZEEM_HEAD">Route to Stationery</option>
            <option value="AVIT_HEAD">Route to AVIT</option>
          </select>
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
            className="sm:col-span-2 flex items-center justify-center space-x-1.5 bg-slate-800 hover:bg-slate-900 text-white font-black text-xs uppercase tracking-wide rounded-xl py-3 transition shadow-sm"
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
                  <span className="text-[10px] font-black text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded ml-2 uppercase tracking-wide">
                    Custom ({item.fulfillment_dept.replace('_HEAD', '')})
                  </span>
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

      {/* Success Modal */}
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