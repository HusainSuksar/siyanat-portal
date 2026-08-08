import { useState, useEffect } from 'react';
import { supabase, type InventoryItem } from '../lib/supabase';
import { Warehouse, Plus, Trash2, Save } from 'lucide-react';

// Define the structure for a single row in our dynamic restock grid
type RestockRow = {
  id: string;
  type: 'EXISTING' | 'NEW';
  itemId: string; // Used if type === 'EXISTING'
  name: string;   // Used if type === 'NEW'
  category: string;
  qty: number;
};

// Common categories from your legacy script
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
      // Initialize with one empty row if catalog loaded successfully
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
      // Process rows individually (or could be batched via RPC in a more advanced setup)
      for (const row of rows) {
        if (row.type === 'NEW') {
          // Insert brand new item
          const { error } = await supabase.from('inventory_items').insert({
            item_id: `CAT-${Math.floor(10000 + Math.random() * 90000)}`, // Generate random ID like legacy script
            name: row.name,
            category: row.category,
            physical_stock: row.qty,
            freezed_stock: 0,
            unit: 'Pcs' // Defaulting to Pcs for now
          });
          if (error) throw error;
        } else if (row.type === 'EXISTING' && row.itemId) {
          // Update existing item by fetching current stock first, then adding
          const item = catalog.find(i => i.id === row.itemId);
          if (item) {
            const newStock = item.physical_stock + row.qty;
            const { error } = await supabase
              .from('inventory_items')
              .update({ physical_stock: newStock })
              .eq('id', row.itemId);
            if (error) throw error;
          }
        }
      }

      alert("Inventory Restocked Successfully!");
      setRows([]);
      fetchCatalog(); // Refresh catalog to get new items and updated quantities
    } catch (err: any) {
      alert("Error processing restock: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 space-y-4 max-w-5xl mx-auto">
        <div className="flex justify-between items-center border-b pb-3">
          <div className="flex items-center space-x-2">
            <Warehouse className="w-5 h-5 text-brand-maroon" />
            <h2 className="font-extrabold text-sm uppercase text-slate-800">Bulk Restock & Add New Stock</h2>
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