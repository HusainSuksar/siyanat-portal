import { useState, useEffect } from 'react';
import { supabase, type InventoryItem } from '../lib/supabase';
import { Warehouse, Plus, Trash2, Save, Search, PackageSearch } from 'lucide-react';

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
  const [searchTerm, setSearchTerm] = useState(''); // New state for searching inventory

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
      if (rows.length === 0) {
        addRow(data);
      }
    }
    setLoading(false);
  };

  const addRow = (currentCatalog = catalog) => {
    const defaultItemId = currentCatalog.length > 0 ? currentCatalog[0].id : '';
    const newRow: RestockRow = {
      id: Math.random().toString(36).substring(7),
      type: 'EXISTING',
      itemId: defaultItemId,
      name: '',
      category: CATEGORIES[0],
      qty: 10,
    };
    setRows(prev => [...prev, newRow]);
  };

  const removeRow = (id: string) => {
    setRows(prev => prev.filter(row => row.id !== id));
  };

  const updateRow = (id: string, field: keyof RestockRow, value: any) => {
    setRows(prev => prev.map(row => 
      row.id === id ? { ...row, [field]: value } : row
    ));
  };

  const submitBulkRestock = async () => {
    if (rows.length === 0) return;
    setSubmitting(true);

    try {
      // Fetch the user so we know who is restocking
      const { data: authData } = await supabase.auth.getUser();
      let totalItemsRestocked = 0;

      for (const row of rows) {
        if (row.type === 'NEW') {
          const { error } = await supabase.from('inventory_items').insert({
            item_id: `CAT-${Math.floor(10000 + Math.random() * 90000)}`,
            name: row.name,
            category: row.category,
            physical_stock: row.qty,
            freezed_stock: 0,
            unit: 'Pcs'
          });
          if (error) throw error;
          totalItemsRestocked += row.qty;
        } else if (row.type === 'EXISTING' && row.itemId) {
          const item = catalog.find(i => i.id === row.itemId);
          if (item) {
            const newStock = item.physical_stock + row.qty;
            const { error } = await supabase
              .from('inventory_items')
              .update({ physical_stock: newStock })
              .eq('id', row.itemId);
            if (error) throw error;
            totalItemsRestocked += row.qty;
          }
        }
      }

      // 🟡 INJECT AUDIT LOG HERE
      await supabase.from('system_logs').insert({
        action_type: 'INVENTORY_RESTOCK',
        description: `Processed bulk restock adding a total of ${totalItemsRestocked} items across ${rows.length} categories/entries.`,
        user_email: authData.user?.email || 'System Admin'
      });

      alert("Inventory Restocked Successfully!");
      setRows([]);
      fetchCatalog();
    } catch (err: any) {
      alert("Error processing restock: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Filter catalog for the new Master Inventory Table
  const filteredCatalog = catalog.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      
      {/* NEW FEATURE: Master Live Inventory Table */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 space-y-4 max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b pb-3">
          <div className="flex items-center space-x-2">
            <PackageSearch className="w-5 h-5 text-brand-maroon" />
            <h2 className="font-extrabold text-sm uppercase text-slate-800">Master Live Inventory</h2>
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
                <th className="p-3 border-b border-slate-200">Item Name</th>
                <th className="p-3 border-b border-slate-200">Category</th>
                <th className="p-3 border-b border-slate-200 text-center">Unit</th>
                <th className="p-3 border-b border-slate-200 text-right">Physical Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-slate-500 font-medium">Fetching warehouse data...</td>
                </tr>
              ) : filteredCatalog.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-slate-500 font-medium italic">No items match your search.</td>
                </tr>
              ) : (
                filteredCatalog.map(item => {
                  const isLowStock = item.physical_stock <= 5;
                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition">
                      <td className="p-3 font-bold text-slate-800">{item.name}</td>
                      <td className="p-3 text-slate-500">{item.category}</td>
                      <td className="p-3 text-center">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 rounded text-[10px] font-bold uppercase">
                          {item.unit}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <span className={`px-2 py-1 rounded-lg text-xs font-extrabold ${isLowStock ? 'bg-red-100 text-red-700' : 'text-slate-800'}`}>
                          {item.physical_stock}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* EXISTING FEATURE: Bulk Restock Grid */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 space-y-4 max-w-5xl mx-auto">
        <div className="flex justify-between items-center border-b pb-3">
          <div className="flex items-center space-x-2">
            <Warehouse className="w-5 h-5 text-brand-maroon" />
            <h2 className="font-extrabold text-sm uppercase text-slate-800">Process Incoming Shipments (Restock)</h2>
          </div>
          <button 
            onClick={() => addRow()}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-lg shadow-sm transition flex items-center space-x-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Another Row</span>
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
                <tr>
                  <td colSpan={5} className="p-6 text-center text-slate-500 font-medium">Loading catalog...</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-slate-500 font-medium italic">Click "Add Another Row" to begin restocking.</td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="p-2 align-top">
                      <select 
                        value={row.type}
                        onChange={(e) => updateRow(row.id, 'type', e.target.value)}
                        className="w-full p-2 bg-white border border-slate-300 rounded text-xs font-bold focus:ring-2 focus:ring-brand-maroon outline-none"
                      >
                        <option value="EXISTING">Existing Item</option>
                        <option value="NEW">New Unlisted Item</option>
                      </select>
                    </td>
                    <td className="p-2 align-top">
                      {row.type === 'EXISTING' ? (
                        <select 
                          value={row.itemId}
                          onChange={(e) => updateRow(row.id, 'itemId', e.target.value)}
                          className="w-full p-2 bg-white border border-slate-300 rounded text-xs font-medium focus:ring-2 focus:ring-brand-maroon outline-none"
                        >
                          {catalog.map(item => (
                            <option key={item.id} value={item.id}>
                              {item.name} (Current: {item.physical_stock})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input 
                          type="text" 
                          placeholder="e.g. PVC Pipe 1-inch" 
                          value={row.name}
                          onChange={(e) => updateRow(row.id, 'name', e.target.value)}
                          className="w-full p-2 bg-white border border-slate-300 rounded text-xs font-medium focus:ring-2 focus:ring-brand-maroon outline-none"
                        />
                      )}
                    </td>
                    <td className="p-2 align-top">
                      <select 
                        value={row.category}
                        onChange={(e) => updateRow(row.id, 'category', e.target.value)}
                        className="w-full p-2 bg-white border border-slate-300 rounded text-xs font-medium focus:ring-2 focus:ring-brand-maroon outline-none"
                      >
                        {CATEGORIES.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2 align-top">
                      <input 
                        type="number" 
                        min="1" 
                        value={row.qty}
                        onChange={(e) => updateRow(row.id, 'qty', parseInt(e.target.value) || 0)}
                        className="w-full p-2 bg-white border border-slate-300 rounded text-xs font-bold text-center focus:ring-2 focus:ring-brand-maroon outline-none"
                      />
                    </td>
                    <td className="p-2 align-top text-right">
                      <button 
                        onClick={() => removeRow(row.id)}
                        className="p-2 text-red-500 hover:bg-red-50 hover:text-red-700 rounded transition"
                        title="Remove Row"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <button 
          onClick={submitBulkRestock}
          disabled={submitting || rows.length === 0}
          className="w-full py-3 mt-4 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-lg transition flex justify-center items-center space-x-2 disabled:opacity-70"
        >
          {submitting ? (
            <span>Processing Database Updates...</span>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>Process All Restock Entries</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}