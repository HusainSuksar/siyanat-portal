import React, { useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Plus, Trash2, Save, Hash, UploadCloud, DownloadCloud, MapPin 
} from 'lucide-react';
import { useToast } from '../../hooks/useToast';

interface RestockRow {
  id: string;
  type: 'EXISTING' | 'NEW';
  itemId: string;
  name: string;
  category: string;
  qty: number;
  fulfillment_dept: string;
  warehouse_location: string;
}

interface Props {
  catalog: any[];
  locations: any[];
  isTanzeemOnly: boolean;
  onRefresh: () => void;
}

const SIYANAT_CATEGORIES = [
  "Electrical & Lighting", "Plumbing & Sanitary", "HVAC & AC Maintenance", 
  "Civil & Masonry", "Carpentry & Hardware", "Painting & Finishes", 
  "Safety & PPE Equipment", "Cleaning & Janitorial Supplies", 
  "Tools & Machinery", "General / Miscellaneous"
];

const TANZEEM_CATEGORIES = [
  "Office & Administrative Supplies", 
  "IT & Networking Hardware"
];

export default function BulkRestockTab({ catalog, locations, isTanzeemOnly, onRefresh }: Props) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<RestockRow[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const availableCategories = isTanzeemOnly 
    ? TANZEEM_CATEGORIES 
    : [...SIYANAT_CATEGORIES, ...TANZEEM_CATEGORIES];

  const defaultLocationName = locations.length > 0 ? locations[0].name : 'Main Store';

  const addRow = () => {
    const defaultItemId = catalog.length > 0 ? catalog[0].id : '';
    setRows(prev => [...prev, {
      id: crypto.randomUUID(),
      type: 'EXISTING',
      itemId: defaultItemId,
      name: '',
      category: availableCategories[0],
      qty: 10,
      fulfillment_dept: isTanzeemOnly ? 'TANZEEM_HEAD' : 'SIYANAT_HEAD',
      warehouse_location: defaultLocationName
    }]);
  };

  const removeRow = (id: string) => setRows(prev => prev.filter(row => row.id !== id));
  
  const updateRow = (id: string, field: keyof RestockRow, value: any) => {
    setRows(prev => prev.map(row => row.id === id ? { ...row, [field]: value } : row));
  };

  const downloadCSVTemplate = () => {
    const headers = "Type (NEW or EXISTING),Item ID (Leave blank if NEW),Item Name,Category,Route To (SIYANAT_HEAD or TANZEEM_HEAD or AVIT_HEAD),Qty,Warehouse Location";
    const sample1 = `EXISTING,uuid-goes-here,Copper Wire,Electrical & Lighting,SIYANAT_HEAD,50,${defaultLocationName}`;
    const sample2 = `NEW,,Brand New Pens,Office & Administrative Supplies,TANZEEM_HEAD,100,${defaultLocationName}`;
    const csvContent = [headers, sample1, sample2].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", "Restock_Template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n');
      const newRows: RestockRow[] = [];
      
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const cols = line.split(','); 
        if (cols.length >= 6) {
           const typeStr = cols[0].trim().toUpperCase();
           const type = typeStr === 'NEW' ? 'NEW' : 'EXISTING';
           const itemId = cols[1].trim();
           const name = cols[2].trim();
           const category = cols[3].trim() || availableCategories[0];
           const fulfillment = cols[4].trim() || 'SIYANAT_HEAD';
           const qty = parseInt(cols[5].trim(), 10) || 1;
           const warehouse_location = cols[6] ? cols[6].trim() : defaultLocationName;

           newRows.push({
             id: crypto.randomUUID(),
             type, itemId, name, category,
             fulfillment_dept: fulfillment,
             warehouse_location,
             qty
           });
        }
      }
      
      if (newRows.length > 0) {
         setRows(prev => [...prev, ...newRows]);
         showToast(`Successfully imported ${newRows.length} items from CSV!`, 'success');
      } else {
         showToast('No valid rows found. Please ensure you followed the template.', 'error');
      }
      
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const submitBulkRestock = async () => {
    if (rows.length === 0) return;
    setSubmitting(true);

    try {
      let totalItemsRestocked = 0;

      for (const row of rows) {
        if (row.type === 'NEW') {
          const { error } = await supabase.from('inventory_items').insert({
            item_id: `CAT-${Math.floor(10000 + Math.random() * 90000)}`,
            name: row.name, 
            category: row.category, 
            physical_stock: row.qty, 
            freezed_stock: 0, 
            unit: 'Pcs',
            fulfillment_dept: row.fulfillment_dept,
            warehouse_location: row.warehouse_location
          });
          if (error) throw error;
          totalItemsRestocked += row.qty;
        } else if (row.type === 'EXISTING' && row.itemId) {
          const item = catalog.find(i => i.id === row.itemId);
          if (item) {
            await supabase.from('inventory_items').update({ 
              physical_stock: item.physical_stock + row.qty,
              warehouse_location: row.warehouse_location || item.warehouse_location 
            }).eq('id', row.itemId);
            totalItemsRestocked += row.qty;
          }
        }
      }

      await supabase.from('system_logs').insert({
        action_type: 'INVENTORY_RESTOCK',
        description: `Processed bulk restock adding ${totalItemsRestocked} items.`,
        user_email: user?.email || 'System Admin'
      });

      showToast("Warehouse Restocked Successfully!", "success");
      setRows([]);
      onRefresh();
    } catch (err: any) {
      showToast("Error processing restock: " + err.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl p-5 md:p-8 shadow-sm border border-slate-200 space-y-5">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-4">
        <div>
          <h3 className="font-black text-sm uppercase tracking-wide text-slate-800">Process Bulk Shipment Restock</h3>
          <p className="text-xs text-slate-500 mt-1 font-medium">Add rows manually or upload a formatted CSV.</p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <button onClick={downloadCSVTemplate} className="px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-black text-xs uppercase tracking-wide rounded-xl shadow-sm transition flex items-center gap-1.5">
            <DownloadCloud className="w-4 h-4 text-brand-maroon" /> Get Template
          </button>
          
          <input type="file" accept=".csv" ref={fileInputRef} onChange={handleCSVUpload} className="hidden" />
          <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-black text-xs uppercase tracking-wide rounded-xl shadow-sm transition flex items-center gap-1.5">
            <UploadCloud className="w-4 h-4 text-emerald-600" /> Upload CSV
          </button>

          <button onClick={addRow} className="px-4 py-2.5 bg-slate-900 hover:bg-black text-white font-black text-xs uppercase tracking-wide rounded-xl shadow-sm transition flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Add Row
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {rows.length === 0 ? (
          <div className="p-12 text-center text-slate-400 font-bold italic bg-slate-50 rounded-2xl border border-slate-100">
            No items added to shipment. Add a row manually or upload a CSV.
          </div>
        ) : (
          rows.map((row, index) => (
            <div key={row.id} className="relative bg-slate-50 rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col gap-4 animate-in fade-in duration-200">
              <button onClick={() => removeRow(row.id)} className="absolute top-3 right-3 p-1.5 text-red-500 hover:bg-red-100 rounded-lg transition" title="Remove">
                <Trash2 className="w-4 h-4" />
              </button>
              <div className="font-black text-slate-400 text-[10px] uppercase tracking-widest flex items-center gap-1">
                <Hash className="w-3 h-3"/> Row {index + 1}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-3">
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5">Source</label>
                  <select value={row.type} onChange={(e) => updateRow(row.id, 'type', e.target.value)} className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none">
                    <option value="EXISTING">Catalog Item</option>
                    <option value="NEW">New Unlisted Item</option>
                  </select>
                </div>
                
                <div className="md:col-span-4">
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5">Item Name</label>
                  {row.type === 'EXISTING' ? (
                    <select value={row.itemId} onChange={(e) => updateRow(row.id, 'itemId', e.target.value)} className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold outline-none">
                      <option value="" disabled>-- Select Item --</option>
                      {catalog.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                  ) : (
                    <input type="text" placeholder="e.g. Copper Wire" value={row.name} onChange={(e) => updateRow(row.id, 'name', e.target.value)} className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold outline-none" />
                  )}
                </div>

                <div className="md:col-span-3">
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-brand-maroon" /> Store / Location
                  </label>
                  <select
                    value={row.warehouse_location}
                    onChange={(e) => updateRow(row.id, 'warehouse_location', e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none"
                  >
                    {locations.map(loc => (
                      <option key={loc.id} value={loc.name}>{loc.name}</option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5">Qty</label>
                  <input type="number" min="1" value={row.qty} onChange={(e) => updateRow(row.id, 'qty', parseInt(e.target.value) || 0)} className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm font-black text-center outline-none" />
                </div>

                {row.type === 'NEW' && (
                  <>
                    <div className="md:col-span-6">
                      <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5">Category</label>
                      <select value={row.category} onChange={(e) => updateRow(row.id, 'category', e.target.value)} className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold outline-none">
                        {availableCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                      </select>
                    </div>
                    <div className="md:col-span-6">
                      <label className="block text-[10px] font-black text-indigo-600 uppercase mb-1.5">Route To</label>
                      <select value={row.fulfillment_dept} onChange={(e) => updateRow(row.id, 'fulfillment_dept', e.target.value)} className="w-full p-2.5 bg-indigo-50 border border-indigo-200 rounded-xl text-xs font-bold text-indigo-900 outline-none focus:ring-2 focus:ring-indigo-500">
                        <option value="SIYANAT_HEAD">Siyanat</option>
                        <option value="TANZEEM_HEAD">Tanzeem</option>
                        <option value="AVIT_HEAD">AVIT</option>
                      </select>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <button onClick={submitBulkRestock} disabled={submitting || rows.length === 0} className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-xl transition flex justify-center items-center gap-2 disabled:opacity-50">
        <Save className="w-4 h-4" /> {submitting ? 'Processing Restock...' : 'Commit Restock to Warehouse'}
      </button>
    </div>
  );
}