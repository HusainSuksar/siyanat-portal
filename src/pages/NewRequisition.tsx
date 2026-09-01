import { useState, useEffect, useMemo } from 'react';
import { supabase, type InventoryItem } from '../lib/supabase';
import { 
  ShoppingBag, Send, PlusCircle, Trash2, CheckCircle, PackageSearch, 
  Search, Wrench, BookOpen, Monitor 
} from 'lucide-react';
import { ZONE_FLOW_MAP, MASTER_ZONES } from '../constants/locations'; 

const DEPARTMENTS = [
  { id: 'SIYANAT_HEAD', label: 'Siyanat (Hardware & Maintenance)', icon: Wrench, color: 'text-amber-600 bg-amber-50 border-amber-200' },
  { id: 'TANZEEM_HEAD', label: 'Tanzeem (Stationery & Admin)', icon: BookOpen, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  { id: 'AVIT_HEAD', label: 'AVIT (Tech, Audio & Networking)', icon: Monitor, color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
];

export default function NewRequisition() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [userRole, setUserRole] = useState('REQUESTER');
  const [isSupervisor, setIsSupervisor] = useState(false);
  const [successBatch, setSuccessBatch] = useState<string | null>(null);
  
  // Department Locking State (Single Dept per Requisition)
  const [selectedDept, setSelectedDept] = useState<'SIYANAT_HEAD' | 'TANZEEM_HEAD' | 'AVIT_HEAD'>('SIYANAT_HEAD');

  // Dynamic Location State
  const [selectedZone, setSelectedZone] = useState('');
  const [selectedVenue, setSelectedVenue] = useState('');
  const [selectedFloor, setSelectedFloor] = useState('');
  const [selectedRoom, setSelectedRoom] = useState('');

  const [urgency, setUrgency] = useState('Normal');
  const [reason, setReason] = useState('');
  
  const [catalog, setCatalog] = useState<InventoryItem[]>([]);
  const [cart, setCart] = useState<{ [key: string]: { item: InventoryItem, qty: number } }>({});
  
  // Search State
  const [searchQuery, setSearchQuery] = useState('');

  // Custom Item State
  const [customItems, setCustomItems] = useState<{ name: string, category: string, qty: number, fulfillment_dept: string }[]>([]);
  const [customName, setCustomName] = useState('');
  const [customQty, setCustomQty] = useState(1);

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

  // Switch department with cart protection
  const handleDepartmentSwitch = (deptId: any) => {
    const hasItems = Object.keys(cart).length > 0 || customItems.length > 0;
    if (hasItems) {
      if (!confirm("Switching departments will clear items currently in your cart. Proceed?")) {
        return;
      }
      setCart({});
      setCustomItems([]);
    }
    setSelectedDept(deptId);
  };

  // Filter catalog strictly for the selected department
  const filteredCatalog = useMemo(() => {
    return catalog.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (item.category && item.category.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesDept = item.fulfillment_dept === selectedDept;
      return matchesSearch && matchesDept;
    });
  }, [catalog, searchQuery, selectedDept]);

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
      name: customName.trim(), 
      category: 'General / Miscellaneous', 
      qty: customQty, 
      fulfillment_dept: selectedDept
    }]);
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
    if (!selectedZone || !selectedVenue) {
      alert("Delivery Zone and Venue are required.");
      return;
    }

    setSubmitting(true);

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not authenticated");

      const fullLocation = [selectedZone, selectedVenue, selectedFloor, selectedRoom].filter(Boolean).join(' - ');

      // Insert work order exactly as before
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
        fulfillment_dept: selectedDept
      }));

      const customOrderItems = customItems.map(c => ({
        work_order_id: orderData.id,
        custom_item_name: c.name,
        requested_qty: c.qty,
        item_type: 'Custom',
        fulfillment_dept: selectedDept
      }));

      const allItemsToInsert = [...orderItems, ...customOrderItems];

      if (allItemsToInsert.length > 0) {
        const { error: itemsError } = await supabase.from('work_order_items').insert(allItemsToInsert);
        if (itemsError) throw itemsError;
      }
      
      await supabase.from('system_logs').insert({
        action_type: 'REQUISITION_SUBMITTED',
        description: `Submitted ${selectedDept.replace('_HEAD', '')} material requisition ${orderData.batch_id || orderData.id} for ${fullLocation}.`,
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

      {/* --- Step 1: Delivery Details --- */}
      <div className="bg-white rounded-3xl p-5 md:p-8 shadow-sm border border-slate-200">
        <div className="flex items-center space-x-2 border-b border-slate-100 pb-4 mb-6">
          <span className="flex items-center justify-center w-6 h-6 bg-brand-maroon text-white text-xs font-black rounded-lg">1</span>
          <h3 className="font-black text-sm uppercase tracking-wide text-slate-800">Delivery Location</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6 animate-in fade-in duration-300">
          <div>
            <label className="block text-[11px] font-black text-slate-500 uppercase mb-2">Delivery Zone *</label>
            <select required disabled={isSupervisor} value={selectedZone} onChange={e => handleZoneChange(e.target.value)} className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-brand-maroon outline-none transition shadow-sm disabled:opacity-70">
              <option value="" disabled>-- Select Zone --</option>
              {MASTER_ZONES.map(zone => <option key={zone} value={zone}>{zone}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-black text-slate-500 uppercase mb-2">Building / Venue *</label>
            <select required disabled={!selectedZone} value={selectedVenue} onChange={e => handleVenueChange(e.target.value)} className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-brand-maroon outline-none transition shadow-sm disabled:opacity-50">
              <option value="" disabled>{selectedZone ? '-- Select Venue --' : 'Select Zone First'}</option>
              {activeVenues?.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
            </select>
          </div>

          {subConfig?.type === 'SELECT_FLOOR_ROOM' && (
            <div>
              <label className="block text-[11px] font-black text-slate-500 uppercase mb-2">Floor / Location *</label>
              <select required value={selectedFloor} onChange={e => { setSelectedFloor(e.target.value); setSelectedRoom(''); }} className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-brand-maroon outline-none">
                <option value="" disabled>-- Choose Floor --</option>
                {Object.keys(subConfig.floors || {}).map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          )}

          {requiresRoomDropdown && (
            <div>
              <label className="block text-[11px] font-black text-slate-500 uppercase mb-2">
                {subConfig?.type === 'SELECT_BATHROOM' ? 'Bathroom No *' : 'Room / Class No *'}
              </label>
              <select required value={selectedRoom} onChange={e => setSelectedRoom(e.target.value)} className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-brand-maroon outline-none">
                <option value="" disabled>-- Select Option --</option>
                {(subConfig?.type === 'SELECT_FLOOR_ROOM' ? availableRoomsForFloor : subConfig?.options || []).map((opt: string) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          )}

          <div className="md:col-span-2 border-t border-slate-100 pt-5 mt-2 grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-[11px] font-black text-slate-500 uppercase mb-2">Urgency</label>
              <select value={urgency} onChange={(e) => setUrgency(e.target.value)} className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none">
                <option value="Normal">Normal</option>
                <option value="High">High</option>
                <option value="EMERGENCY (Immediate)">EMERGENCY (Immediate)</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-black text-slate-500 uppercase mb-2">Reason</label>
              <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Scheduled Maintenance / Office Setup" className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none" />
            </div>
          </div>
        </div>
      </div>

      {/* --- Step 2: Department Selection (Single Department Rule) --- */}
      <div className="bg-white rounded-3xl p-5 md:p-8 shadow-sm border border-slate-200">
        <div className="flex items-center space-x-2 border-b border-slate-100 pb-4 mb-5">
          <span className="flex items-center justify-center w-6 h-6 bg-brand-maroon text-white text-xs font-black rounded-lg">2</span>
          <h3 className="font-black text-sm uppercase tracking-wide text-slate-800">Select Target Department</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-6">
          {DEPARTMENTS.map(d => {
            const Icon = d.icon;
            const isSelected = selectedDept === d.id;
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => handleDepartmentSwitch(d.id)}
                className={`p-4 rounded-2xl border-2 flex flex-col items-center justify-center gap-2.5 transition text-center ${
                  isSelected 
                    ? 'border-brand-maroon bg-brand-maroon/5 shadow-md' 
                    : 'border-slate-200 hover:border-slate-300 bg-slate-50'
                }`}
              >
                <div className={`p-2.5 rounded-xl border ${d.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <span className={`text-xs font-black uppercase tracking-wide block ${isSelected ? 'text-brand-maroon' : 'text-slate-800'}`}>
                    {d.label.split(' (')[0]}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">
                    ({d.label.split(' (')[1]}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
          <input 
            type="text" 
            placeholder={`Search ${selectedDept.replace('_HEAD', '')} items by name...`}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-brand-maroon transition shadow-sm"
          />
        </div>
        
        {loading ? (
          <div className="text-center py-12 text-slate-500 text-sm font-bold animate-pulse bg-slate-50 rounded-2xl">Loading Catalog...</div>
        ) : filteredCatalog.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm font-bold bg-slate-50 rounded-2xl border border-slate-100">
            No items found in {selectedDept.replace('_HEAD', '')} catalog.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredCatalog.map(item => {
              const available = Math.max(0, item.physical_stock - item.freezed_stock);
              const isOutOfStock = available <= 0;
              const currentQty = cart[item.id]?.qty || 0;
              const canSeeStock = ['SUPER_ADMIN', 'SUPERVISOR', 'SIYANAT_HEAD', 'TANZEEM_HEAD', 'AVIT_HEAD'].includes(userRole);

              return (
                <div key={item.id} className={`rounded-2xl p-4 border flex flex-col justify-between transition-all ${currentQty > 0 ? 'border-brand-maroon bg-brand-maroon/5 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-[10px] font-black text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 uppercase tracking-widest">{item.unit || 'Pcs'}</span>
                      {canSeeStock ? (
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider ${isOutOfStock ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-800'}`}>
                          {isOutOfStock ? 'Out of Stock' : `Avail: ${available}`}
                        </span>
                      ) : (
                        <span className="text-[9px] font-black px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 uppercase tracking-wider">
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
                      className="w-16 px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-sm font-black text-center disabled:opacity-50 focus:ring-2 focus:ring-brand-maroon outline-none"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* --- Step 3: Unlisted Custom Items --- */}
      <div className="bg-amber-50/50 rounded-3xl p-5 md:p-8 border border-amber-200">
        <h3 className="text-xs font-black text-amber-900 uppercase tracking-wider mb-2">Request Unlisted Item ({selectedDept.replace('_HEAD', '')})</h3>
        <p className="text-[11px] font-bold text-amber-700/80 mb-4">Can't find what you need in the catalog? Enter custom item details:</p>
        
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <input 
            type="text" 
            placeholder="Describe custom item clearly..." 
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            className="sm:col-span-8 px-4 py-3 bg-white border border-slate-300 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-brand-maroon"
          />
          <input 
            type="number" 
            min="1" 
            value={customQty}
            onChange={(e) => setCustomQty(parseInt(e.target.value) || 1)}
            className="sm:col-span-2 px-4 py-3 bg-white border border-slate-300 rounded-xl text-sm font-black text-center outline-none focus:ring-2 focus:ring-brand-maroon"
          />
          <button 
            type="button"
            onClick={addCustomItem}
            className="sm:col-span-2 flex items-center justify-center space-x-1.5 bg-slate-800 hover:bg-slate-900 text-white font-black text-xs uppercase tracking-wide rounded-xl py-3 transition"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Add</span>
          </button>
        </div>

        {customItems.length > 0 && (
          <div className="mt-4 space-y-2">
            {customItems.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-200 text-sm shadow-sm">
                <div>
                  <span className="font-bold text-slate-800">{item.name}</span>
                  <span className="text-[10px] font-black text-amber-700 bg-amber-100 px-2 py-0.5 rounded ml-2 uppercase">Custom</span>
                </div>
                <div className="flex items-center space-x-4">
                  <span className="font-black text-slate-700 bg-slate-100 px-2 py-1 rounded">Qty: {item.qty}</span>
                  <button onClick={() => removeCustomItem(idx)} className="text-slate-400 hover:text-red-600 p-1 rounded transition"><Trash2 className="w-4 h-4" /></button>
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
                <p className="text-[10px] md:text-xs text-slate-400 font-bold uppercase tracking-wider">{selectedDept.replace('_HEAD', '')} Order</p>
                <p className="text-sm md:text-base font-black"><span className="text-brand-gold">{totalSelected}</span> Item(s) Selected</p>
              </div>
            </div>
            <button 
              onClick={submitRequisition}
              disabled={submitting}
              className="px-5 py-3 md:py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-lg transition flex items-center space-x-2 disabled:opacity-70"
            >
              <span>{submitting ? 'Processing...' : 'Submit Requisition'}</span>
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
              Your requisition has been routed to {selectedDept.replace('_HEAD', '')} for fulfillment.
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