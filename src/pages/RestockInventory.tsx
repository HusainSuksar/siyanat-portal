import { useState, useEffect } from 'react';
import { supabase, type InventoryItem } from '../lib/supabase';
import { Warehouse, Plus, Trash2, Save, Search, PackageSearch, Edit, X, CheckCircle } from 'lucide-react';

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

      // 2. 🟢 AUTO-FULFILLMENT ENGINE (The Missing Link)
      // Check for any pending items that can now be fulfilled with the newly added stock
      const { data: pendingItems } = await supabase
        .from('work_order_items')
        .select('id, inventory_id, requested_qty, work_order_id, item_type')
        .in('status', ['Pending', 'Ordered'])
        .order('id', { ascending: true }); // First-Come, First-Served proxy

      if (pendingItems) {
        let autoFulfilledCount = 0;
        for (const pItem of pendingItems) {
          if (pItem.item_type !== 'Catalog' || !pItem.inventory_id) continue;
          
          const { data: inv } = await supabase.from('inventory_items').select('physical_stock, freezed_stock').eq('id', pItem.inventory_id).single();
          if (inv) {
            const available = inv.physical_stock - inv.freezed_stock;
            if (available >= pItem.requested_qty) {
              // Fulfill the item!
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
      
      {/* --- MASTER LIVE INVENTORY TABLE --- */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 space-y-4 max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b pb-3">
          <div className="flex items-center space-x-2">
            <PackageSearch className="w-5 h-5 text-brand-maroon" />
            <h2 className="font-extrabold text-sm uppercase text-slate-800">Master Live Catalog</h2>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input 
              type="text" 
              placeholder="Search items or categories..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-brand-maroon outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto max-h-[400px] overflow-y-auto rounded-lg border border-slate-200">
          <table className="w-full text-left text-xs border-collapse relative">
            <thead className="bg-slate-100 text-slate-700 uppercase font-bold sticky top-0 shadow-sm">
              <tr>
                <th className="p-3 border-b border-slate-200">Item Name & ID</th>
                <th className="p-3 border-b border-slate-200">Category</th>
                <th className="p-3 border-b border-slate-200 text-center">Stock Info</th>
                <th className="p-3 border-b border-slate-200 text-right">Admin Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={4} className="p-6 text-center text-slate-500 font-medium">Fetching warehouse data...</td></tr>
              ) : filteredCatalog.length === 0 ? (
                <tr><td colSpan={4} className="p-6 text-center text-slate-500 font-medium italic">No items match your search.</td></tr>
              ) : (
                filteredCatalog.map(item => {
                  const isLowStock = (item.physical_stock - item.freezed_stock) <= 5;
                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition">
                      <td className="p-3">
                        <div className="font-bold text-slate-800">{item.name}</div>
                        <div className="text-[9px] text-slate-400 font-mono mt-0.5">{item.item_id}</div>
                      </td>
                      <td className="p-3 text-slate-500 font-medium">{item.category}</td>
                      <td className="p-3">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${isLowStock ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-800'}`}>
                            Avail: {item.physical_stock - item.freezed_stock} {item.unit}
                          </span>
                          <span className="text-[9px] text-slate-400 font-bold uppercase">
                            (Physical: {item.physical_stock} | Frozen: {item.freezed_stock})
                          </span>
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => { setEditingItem(item); setEditModalOpen(true); }} disabled={processingId === item.id} className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition disabled:opacity-50">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDeleteItem(item.id, item.name)} disabled={processingId === item.id} className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition disabled:opacity-50">
                            <Trash2 className="w-4 h-4" />
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

      {/* --- BULK RESTOCK GRID --- */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 space-y-4 max-w-5xl mx-auto">
        <div className="flex justify-between items-center border-b pb-3">
          <div className="flex items-center space-x-2">
            <Warehouse className="w-5 h-5 text-brand-maroon" />
            <h2 className="font-extrabold text-sm uppercase text-slate-800">Process Incoming Shipments (Restock)</h2>
          </div>
          <button onClick={() => addRow()} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-lg shadow-sm transition flex items-center space-x-1">
            <Plus className="w-3.5 h-3.5" /><span>Add Another Row</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 text-slate-700 uppercase font-bold border-b border-slate-200">
              <tr>
                <th className="p-3 w-40">Item Source</th>
                <th className="p-3">Item Details / Name</th>
                <th className="p-3 w-48">Category</th>
                <th className="p-3 w-24 text-center">Qty</th>
                <th className="p-3 w-20 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading && catalog.length === 0 ? (
                <tr><td colSpan={5} className="p-6 text-center text-slate-500 font-medium">Loading catalog...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={5} className="p-6 text-center text-slate-500 font-medium italic">Click "Add Another Row" to begin restocking.</td></tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="p-2 align-top">
                      <select value={row.type} onChange={(e) => updateRow(row.id, 'type', e.target.value)} className="w-full p-2 bg-white border border-slate-300 rounded text-xs font-bold focus:ring-2 focus:ring-brand-maroon outline-none">
                        <option value="EXISTING">Existing Item</option>
                        <option value="NEW">New Unlisted Item</option>
                      </select>
                    </td>
                    <td className="p-2 align-top">
                      {row.type === 'EXISTING' ? (
                        <select value={row.itemId} onChange={(e) => updateRow(row.id, 'itemId', e.target.value)} className="w-full p-2 bg-white border border-slate-300 rounded text-xs font-medium focus:ring-2 focus:ring-brand-maroon outline-none">
                          {catalog.map(item => <option key={item.id} value={item.id}>{item.name} (Avail: {item.physical_stock - item.freezed_stock})</option>)}
                        </select>
                      ) : (
                        <input type="text" placeholder="e.g. PVC Pipe 1-inch" value={row.name} onChange={(e) => updateRow(row.id, 'name', e.target.value)} className="w-full p-2 bg-white border border-slate-300 rounded text-xs font-medium focus:ring-2 focus:ring-brand-maroon outline-none" />
                      )}
                    </td>
                    <td className="p-2 align-top">
                      <select value={row.category} onChange={(e) => updateRow(row.id, 'category', e.target.value)} className="w-full p-2 bg-white border border-slate-300 rounded text-xs font-medium focus:ring-2 focus:ring-brand-maroon outline-none">
                        {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                      </select>
                    </td>
                    <td className="p-2 align-top">
                      <input type="number" min="1" value={row.qty} onChange={(e) => updateRow(row.id, 'qty', parseInt(e.target.value) || 0)} className="w-full p-2 bg-white border border-slate-300 rounded text-xs font-bold text-center focus:ring-2 focus:ring-brand-maroon outline-none" />
                    </td>
                    <td className="p-2 align-top text-right">
                      <button onClick={() => removeRow(row.id)} className="p-2 text-red-500 hover:bg-red-50 hover:text-red-700 rounded transition" title="Remove Row"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <button onClick={submitBulkRestock} disabled={submitting || rows.length === 0} className="w-full py-3 mt-4 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-lg transition flex justify-center items-center space-x-2 disabled:opacity-70">
          {submitting ? <span>Processing Updates & Fulfilling RTO...</span> : <><Save className="w-4 h-4" /><span>Process Restock & Auto-Fulfill Pended</span></>}
        </button>
      </div>

      {/* --- GOD MODE: EDIT ITEM MODAL --- */}
      {editModalOpen && editingItem && (
        <div className="fixed inset-0 bg-black/50 z-50 flex justify-center items-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
            <div className="bg-slate-800 p-4 flex justify-between items-center text-white">
              <h3 className="font-extrabold text-sm uppercase">Edit Master Catalog</h3>
              <button onClick={() => setEditModalOpen(false)}><X className="w-5 h-5 hover:text-red-300" /></button>
            </div>
            
            <form onSubmit={handleUpdateItem} className="p-5 space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Item Name</label>
                <input required type="text" value={editingItem.name} onChange={e => setEditingItem({...editingItem, name: e.target.value})} className="w-full p-2 border border-slate-300 rounded-lg text-sm font-semibold outline-none focus:ring-2 focus:ring-brand-maroon"/>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Category</label>
                <select required value={editingItem.category} onChange={e => setEditingItem({...editingItem, category: e.target.value})} className="w-full p-2 border border-slate-300 rounded-lg text-sm font-semibold outline-none focus:ring-2 focus:ring-brand-maroon">
                  {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Measurement Unit</label>
                  <input required type="text" value={editingItem.unit} onChange={e => setEditingItem({...editingItem, unit: e.target.value})} placeholder="e.g. Pcs, Box, Kg" className="w-full p-2 border border-slate-300 rounded-lg text-sm font-semibold outline-none focus:ring-2 focus:ring-brand-maroon"/>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-emerald-700 uppercase mb-1">Physical Stock</label>
                  <input required type="number" min="0" value={editingItem.physical_stock} onChange={e => setEditingItem({...editingItem, physical_stock: parseInt(e.target.value) || 0})} className="w-full p-2 border border-emerald-300 bg-emerald-50 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500"/>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-indigo-700 uppercase mb-1">Frozen Stock</label>
                  <input required type="number" min="0" value={editingItem.freezed_stock} onChange={e => setEditingItem({...editingItem, freezed_stock: parseInt(e.target.value) || 0})} className="w-full p-2 border border-indigo-300 bg-indigo-50 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"/>
                </div>
              </div>

              <button type="submit" disabled={processingId === editingItem.id} className="w-full py-3 mt-4 bg-slate-900 hover:bg-black text-white font-extrabold text-xs uppercase rounded-xl shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2">
                <CheckCircle className="w-4 h-4" /> Force Update Item
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}