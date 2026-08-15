import { useState, useEffect } from 'react';
import { supabase, type InventoryItem } from '../lib/supabase';
import { Warehouse, Plus, Trash2, Save, Search, PackageSearch, Edit, X, CheckCircle, Hash } from 'lucide-react';

type RestockRow = {
  id: string;
  type: 'EXISTING' | 'NEW';
  itemId: string;
  name: string;
  category: string;
  qty: number;
};

const CATEGORIES = [
  "Electrical & Lighting", "Plumbing & Sanitary", "HVAC & AC Maintenance", 
  "Civil & Masonry", "Carpentry & Hardware", "Painting & Finishes", 
  "Safety & PPE Equipment", "Cleaning & Janitorial Supplies", "Office & Administrative Supplies", 
  "IT & Networking Hardware", "Tools & Machinery", "General / Miscellaneous"
];

export default function RestockInventory() {
  const [catalog, setCatalog] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [rows, setRows] = useState<RestockRow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // God Mode Edit State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchCatalog();
  }, []);

  const fetchCatalog = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('inventory_items').select('*').order('name');
    if (data && !error) {
      setCatalog(data);
      if (rows.length === 0 && data.length > 0) {
        addRow(data);
      }
    }
    setLoading(false);
  };

  const addRow = (currentCatalog = catalog) => {
    const defaultItemId = currentCatalog.length > 0 ? currentCatalog[0].id : '';
    setRows(prev => [...prev, {
      id: Math.random().toString(36).substring(7),
      type: 'EXISTING',
      itemId: defaultItemId,
      name: '',
      category: CATEGORIES[0],
      qty: 10,
    }]);
  };

  const removeRow = (id: string) => setRows(prev => prev.filter(row => row.id !== id));
  const updateRow = (id: string, field: keyof RestockRow, value: any) => setRows(prev => prev.map(row => row.id === id ? { ...row, [field]: value } : row));

  const submitBulkRestock = async () => {
    if (rows.length === 0) return;
    setSubmitting(true);

    try {
      const { data: authData } = await supabase.auth.getUser();
      let totalItemsRestocked = 0;

      // 1. Process Stock Additions
      for (const row of rows) {
        if (row.type === 'NEW') {
          const { error } = await supabase.from('inventory_items').insert({
            item_id: `CAT-${Math.floor(10000 + Math.random() * 90000)}`,
            name: row.name, category: row.category, physical_stock: row.qty, freezed_stock: 0, unit: 'Pcs'
          });
          if (error) throw error;
          totalItemsRestocked += row.qty;
        } else if (row.type === 'EXISTING' && row.itemId) {
          const item = catalog.find(i => i.id === row.itemId);
          if (item) {
            await supabase.from('inventory_items').update({ physical_stock: item.physical_stock + row.qty }).eq('id', row.itemId);
            totalItemsRestocked += row.qty;
          }
        }
      }

      await supabase.from('system_logs').insert({
        action_type: 'INVENTORY_RESTOCK',
        description: `Processed bulk restock adding ${totalItemsRestocked} items.`,
        user_email: authData.user?.email || 'System Admin'
      });

      // 2. AUTO-FULFILLMENT ENGINE
      const { data: pendingItems } = await supabase
        .from('work_order_items')
        .select('id, inventory_id, requested_qty, work_order_id, item_type')
        .in('status', ['Pending', 'Ordered'])
        .order('id', { ascending: true });

      if (pendingItems) {
        let autoFulfilledCount = 0;
        for (const pItem of pendingItems) {
          if (pItem.item_type !== 'Catalog' || !pItem.inventory_id) continue;
          
          const { data: inv } = await supabase.from('inventory_items').select('physical_stock, freezed_stock').eq('id', pItem.inventory_id).single();
          if (inv) {
            const available = inv.physical_stock - inv.freezed_stock;
            if (available >= pItem.requested_qty) {
              await supabase.from('work_order_items').update({ status: 'Available' }).eq('id', pItem.id);
              await supabase.from('inventory_items').update({ freezed_stock: inv.freezed_stock + pItem.requested_qty }).eq('id', pItem.inventory_id);
              await supabase.from('work_orders').update({ dispatch_status: 'Pending' }).eq('id', pItem.work_order_id);
              autoFulfilledCount++;
            }
          }
        }

        if (autoFulfilledCount > 0) {
          await supabase.from('system_logs').insert({
            action_type: 'AUTO_FULFILLMENT',
            description: `Auto-fulfillment Engine successfully fulfilled ${autoFulfilledCount} pending items from the RTO queue using new stock.`,
            user_email: authData.user?.email || 'System Admin'
          });
        }
      }

      alert("Inventory Restocked & Auto-Fulfillment Engine executed successfully!");
      setRows([]);
      fetchCatalog();
    } catch (err: any) {
      alert("Error processing restock: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // --- GOD MODE: EDIT & DELETE INVENTORY ---
  const handleUpdateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    setProcessingId(editingItem.id);

    const { error } = await supabase.from('inventory_items').update({
      name: editingItem.name,
      category: editingItem.category,
      unit: editingItem.unit,
      physical_stock: editingItem.physical_stock,
      freezed_stock: editingItem.freezed_stock
    }).eq('id', editingItem.id);

    if (!error) {
      const { data: authData } = await supabase.auth.getUser();
      await supabase.from('system_logs').insert({
        action_type: 'INVENTORY_MODIFIED',
        description: `Admin manually modified master catalog item: ${editingItem.name}.`,
        user_email: authData.user?.email || 'System Admin'
      });
      alert('Item updated successfully.');
      setEditModalOpen(false);
      fetchCatalog();
    } else {
      alert("Error updating item.");
    }
    setProcessingId(null);
  };

  const handleDeleteItem = async (id: string, name: string) => {
    if (!confirm(`GOD MODE WARNING: Are you sure you want to completely eradicate '${name}' from the master catalog? This will fail if it's tied to existing historical requests.`)) return;
    setProcessingId(id);

    const { error } = await supabase.from('inventory_items').delete().eq('id', id);
    if (!error) {
      const { data: authData } = await supabase.auth.getUser();
      await supabase.from('system_logs').insert({
        action_type: 'GOD_MODE_DELETE',
        description: `Admin hard-deleted master catalog item: ${name}.`,
        user_email: authData.user?.email || 'System Admin'
      });
      fetchCatalog();
    } else {
      alert("Cannot delete item. It is currently linked to historical batches or request logs.");
    }
    setProcessingId(null);
  };

  const filteredCatalog = catalog.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()) || item.category.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-6 pb-24">
      
      {/* --- MASTER LIVE INVENTORY (Mobile-Friendly Cards) --- */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 space-y-4 max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4">
          <div className="flex items-center space-x-2">
            <PackageSearch className="w-5 h-5 text-brand-maroon" />
            <h2 className="font-extrabold text-sm uppercase text-slate-800">Master Live Catalog</h2>
          </div>
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input 
              type="text" 
              placeholder="Search items or categories..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-brand-maroon outline-none transition"
            />
          </div>
        </div>

        <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
          {loading ? (
            <div className="p-6 text-center text-slate-500 font-medium animate-pulse bg-slate-50 rounded-xl border border-slate-100">Fetching warehouse data...</div>
          ) : filteredCatalog.length === 0 ? (
            <div className="p-6 text-center text-slate-500 font-medium italic bg-slate-50 rounded-xl border border-slate-100">No items match your search.</div>
          ) : (
            filteredCatalog.map(item => {
              const isLowStock = (item.physical_stock - item.freezed_stock) <= 5;
              return (
                <div key={item.id} className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 transition hover:border-slate-300">
                  
                  <div className="flex-1 space-y-2">
                    <div>
                      <h3 className="font-bold text-slate-800 text-sm">{item.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-slate-500 font-mono bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">{item.item_id}</span>
                        <span className="text-[10px] font-semibold text-slate-500 line-clamp-1">{item.category}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      <div>
                        <div className="text-[9px] text-slate-400 uppercase font-black tracking-wide mb-1">Available</div>
                        <span className={`px-2 py-0.5 rounded text-[11px] font-extrabold shadow-sm ${isLowStock ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-emerald-100 text-emerald-800 border border-emerald-200'}`}>
                          {item.physical_stock - item.freezed_stock} {item.unit}
                        </span>
                      </div>
                      <div>
                        <div className="text-[9px] text-slate-400 uppercase font-black tracking-wide mb-1">Breakdown</div>
                        <span className="text-[10px] text-slate-600 font-bold">
                          Phy: {item.physical_stock} | Frz: {item.freezed_stock}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-row md:flex-col gap-2 w-full md:w-auto border-t md:border-t-0 border-slate-100 pt-3 md:pt-0">
                    <button 
                      onClick={() => { setEditingItem(item); setEditModalOpen(true); }} 
                      disabled={processingId === item.id} 
                      className="flex-1 md:w-full py-2.5 md:py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      <Edit className="w-4 h-4 md:w-3.5 md:h-3.5" /> <span className="md:hidden text-xs font-bold">Edit</span>
                    </button>
                    <button 
                      onClick={() => handleDeleteItem(item.id, item.name)} 
                      disabled={processingId === item.id} 
                      className="flex-1 md:w-full py-2.5 md:py-2 px-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      <Trash2 className="w-4 h-4 md:w-3.5 md:h-3.5" /> <span className="md:hidden text-xs font-bold">Delete</span>
                    </button>
                  </div>
                  
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* --- BULK RESTOCK GRID (Mobile-Friendly Cards) --- */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 space-y-4 max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4">
          <div className="flex items-center space-x-2">
            <Warehouse className="w-5 h-5 text-brand-maroon" />
            <h2 className="font-extrabold text-sm uppercase text-slate-800">Incoming Shipments (Restock)</h2>
          </div>
          <button 
            onClick={() => addRow()} 
            className="w-full sm:w-auto px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-sm transition flex justify-center items-center space-x-2"
          >
            <Plus className="w-4 h-4" /><span>Add Row</span>
          </button>
        </div>

        <div className="space-y-4">
          {loading && catalog.length === 0 ? (
            <div className="p-6 text-center text-slate-500 font-medium bg-slate-50 rounded-xl border border-slate-100">Loading catalog...</div>
          ) : rows.length === 0 ? (
            <div className="p-6 text-center text-slate-500 font-medium italic bg-slate-50 rounded-xl border border-slate-100">Click "Add Row" to begin restocking.</div>
          ) : (
            rows.map((row, index) => (
              <div key={row.id} className="relative bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200">
                
                {/* Remove Button for Mobile/Desktop */}
                <button 
                  onClick={() => removeRow(row.id)} 
                  className="absolute top-3 right-3 p-2 text-red-500 hover:bg-red-100 rounded-lg transition z-10" 
                  title="Remove Row"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                
                <div className="font-black text-slate-300 text-xs uppercase flex items-center gap-1"><Hash className="w-3 h-3"/> Row {index + 1}</div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  {/* Item Source */}
                  <div className="md:col-span-3">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Item Source</label>
                    <select 
                      value={row.type} 
                      onChange={(e) => updateRow(row.id, 'type', e.target.value)} 
                      className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-brand-maroon outline-none transition"
                    >
                      <option value="EXISTING">Existing Catalog Item</option>
                      <option value="NEW">New Unlisted Item</option>
                    </select>
                  </div>
                  
                  {/* Item Details */}
                  <div className="md:col-span-4">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Item Details</label>
                    {row.type === 'EXISTING' ? (
                      <select 
                        value={row.itemId} 
                        onChange={(e) => updateRow(row.id, 'itemId', e.target.value)} 
                        className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-brand-maroon outline-none transition"
                      >
                        {catalog.map(item => <option key={item.id} value={item.id}>{item.name} (Avail: {item.physical_stock - item.freezed_stock})</option>)}
                      </select>
                    ) : (
                      <input 
                        type="text" 
                        placeholder="e.g. PVC Pipe 1-inch" 
                        value={row.name} 
                        onChange={(e) => updateRow(row.id, 'name', e.target.value)} 
                        className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-brand-maroon outline-none transition" 
                      />
                    )}
                  </div>

                  {/* Category */}
                  <div className="md:col-span-3">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Category</label>
                    <select 
                      value={row.category} 
                      onChange={(e) => updateRow(row.id, 'category', e.target.value)} 
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-brand-maroon outline-none transition"
                    >
                      {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>

                  {/* Qty */}
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Quantity</label>
                    <input 
                      type="number" 
                      min="1" 
                      value={row.qty} 
                      onChange={(e) => updateRow(row.id, 'qty', parseInt(e.target.value) || 0)} 
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-sm font-black text-center focus:ring-2 focus:ring-brand-maroon outline-none transition" 
                    />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <button 
          onClick={submitBulkRestock} 
          disabled={submitting || rows.length === 0} 
          className="w-full py-4 mt-6 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs md:text-sm uppercase tracking-wider rounded-xl shadow-lg transition flex justify-center items-center space-x-2 disabled:opacity-70"
        >
          {submitting ? <span>Processing Updates...</span> : <><Save className="w-5 h-5" /><span>Process Restock & Auto-Fulfill Pended</span></>}
        </button>
      </div>

      {/* --- GOD MODE: EDIT ITEM MODAL --- */}
      {editModalOpen && editingItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex justify-center items-end sm:items-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300">
            <div className="bg-slate-800 p-5 flex justify-between items-center text-white">
              <h3 className="font-extrabold text-sm uppercase">Edit Catalog Item</h3>
              <button onClick={() => setEditModalOpen(false)} className="p-1 hover:bg-white/20 rounded-lg transition"><X className="w-5 h-5 hover:text-red-300" /></button>
            </div>
            
            <form onSubmit={handleUpdateItem} className="p-6 space-y-5">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Item Name</label>
                <input required type="text" value={editingItem.name} onChange={e => setEditingItem({...editingItem, name: e.target.value})} className="w-full p-3 border border-slate-300 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-brand-maroon transition"/>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Category</label>
                <select required value={editingItem.category} onChange={e => setEditingItem({...editingItem, category: e.target.value})} className="w-full p-3 border border-slate-300 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-brand-maroon transition">
                  {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">Measurement Unit</label>
                  <input required type="text" value={editingItem.unit} onChange={e => setEditingItem({...editingItem, unit: e.target.value})} placeholder="e.g. Pcs, Box, Kg" className="w-full p-3 border border-slate-300 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-brand-maroon transition"/>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-emerald-700 uppercase mb-1.5">Physical Stock</label>
                  <input required type="number" min="0" value={editingItem.physical_stock} onChange={e => setEditingItem({...editingItem, physical_stock: parseInt(e.target.value) || 0})} className="w-full p-3 border border-emerald-300 bg-emerald-50 rounded-xl text-sm font-black text-center outline-none focus:ring-2 focus:ring-emerald-500 transition"/>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-indigo-700 uppercase mb-1.5">Frozen Stock</label>
                  <input required type="number" min="0" value={editingItem.freezed_stock} onChange={e => setEditingItem({...editingItem, freezed_stock: parseInt(e.target.value) || 0})} className="w-full p-3 border border-indigo-300 bg-indigo-50 rounded-xl text-sm font-black text-center outline-none focus:ring-2 focus:ring-indigo-500 transition"/>
                </div>
              </div>

              <button type="submit" disabled={processingId === editingItem.id} className="w-full py-3.5 mt-2 bg-slate-900 hover:bg-black text-white font-extrabold text-xs uppercase tracking-wide rounded-xl shadow-lg transition disabled:opacity-50 flex items-center justify-center gap-2">
                <CheckCircle className="w-4 h-4" /> Force Update Item
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}